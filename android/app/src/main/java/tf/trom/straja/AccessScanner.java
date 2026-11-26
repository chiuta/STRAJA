package tf.trom.straja;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.provider.Settings;
import android.view.accessibility.AccessibilityManager;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Citește (fără nicio permisiune specială în afară de QUERY_ALL_PACKAGES) căile prin care o
 * aplicație - inclusiv un agent AI - poate vedea conținutul telefonului:
 * acces la notificări, servicii de accesibilitate, asistent digital și permisiuni de media/SMS.
 * Nu trimite nimic în afara dispozitivului.
 */
final class AccessScanner {

    static final class App {
        String pkg;
        String label;
        boolean system;
        boolean notif;
        boolean a11y;
        boolean readsScreen;
        boolean assistant;
        final Set<String> perms = new LinkedHashSet<>();
        final Set<String> declared = new LinkedHashSet<>();

        boolean hasSignal() {
            return notif || a11y || assistant || !perms.isEmpty() || !declared.isEmpty();
        }
    }

    static final class Result {
        final List<App> apps = new ArrayList<>();
        String assistantPkg;
    }

    /** Permisiuni runtime acordate care expun conținut personal. */
    private static final Map<String, String> RUNTIME = new LinkedHashMap<>();
    /** Accese speciale (nu apar ca "acordate" în PackageInfo) - le raportăm doar ca "declarate". */
    private static final Map<String, String> SPECIAL = new LinkedHashMap<>();

    static {
        RUNTIME.put("android.permission.READ_MEDIA_IMAGES", "images");
        RUNTIME.put("android.permission.READ_MEDIA_VIDEO", "video");
        RUNTIME.put("android.permission.READ_MEDIA_VISUAL_USER_SELECTED", "selected");
        RUNTIME.put("android.permission.READ_EXTERNAL_STORAGE", "storage");
        RUNTIME.put("android.permission.READ_SMS", "sms");
        RUNTIME.put("android.permission.RECEIVE_SMS", "sms");
        RUNTIME.put("android.permission.READ_CONTACTS", "contacts");
        RUNTIME.put("android.permission.READ_CALL_LOG", "calllog");
        RUNTIME.put("android.permission.RECORD_AUDIO", "mic");
        SPECIAL.put("android.permission.MANAGE_EXTERNAL_STORAGE", "allfiles");
        SPECIAL.put("android.permission.SYSTEM_ALERT_WINDOW", "overlay");
    }

    private AccessScanner() {}

    static Result scan(Context ctx) {
        PackageManager pm = ctx.getPackageManager();
        Set<String> notif = notificationListeners(ctx);
        Map<String, Boolean> a11y = accessibility(ctx);
        Result r = new Result();
        r.assistantPkg = assistantPackage(ctx);
        String self = ctx.getPackageName();

        for (ApplicationInfo ai : installedApps(pm)) {
            if (ai == null || ai.packageName == null || ai.packageName.equals(self)) continue;
            App a = new App();
            a.pkg = ai.packageName;
            a.system = (ai.flags & (ApplicationInfo.FLAG_SYSTEM | ApplicationInfo.FLAG_UPDATED_SYSTEM_APP)) != 0;
            a.notif = notif.contains(a.pkg);
            Boolean reads = a11y.get(a.pkg);
            a.a11y = reads != null;
            a.readsScreen = reads != null && reads;
            a.assistant = a.pkg.equals(r.assistantPkg);
            fillPermissions(pm, a);
            if (a.system && !a.hasSignal()) continue;
            try {
                CharSequence l = pm.getApplicationLabel(ai);
                a.label = l == null ? a.pkg : l.toString();
            } catch (Exception e) {
                a.label = a.pkg;
            }
            r.apps.add(a);
        }
        return r;
    }

    /** Semnalele de risc ridicat folosite de monitorizarea din fundal (set stabil de șiruri). */
    static Set<String> signals(Result r) {
        Set<String> s = new LinkedHashSet<>();
        for (App a : r.apps) {
            if (a.notif) s.add(a.pkg + "|notif");
            if (a.a11y) s.add(a.pkg + "|a11y");
            if (a.assistant) s.add(a.pkg + "|assistant");
            for (String p : a.perms) {
                if (p.equals("images") || p.equals("video") || p.equals("storage") || p.equals("sms")
                        || p.equals("calllog")) {
                    s.add(a.pkg + "|perm:" + p);
                }
            }
        }
        return s;
    }

    static Map<String, App> byPackage(Result r) {
        Map<String, App> m = new HashMap<>();
        for (App a : r.apps) m.put(a.pkg, a);
        return m;
    }

    // ------------------------------------------------------------------ surse

    private static Set<String> notificationListeners(Context ctx) {
        Set<String> out = new LinkedHashSet<>();
        try {
            String flat = Settings.Secure.getString(ctx.getContentResolver(), "enabled_notification_listeners");
            if (flat == null || flat.isEmpty()) return out;
            for (String part : flat.split(":")) {
                ComponentName cn = ComponentName.unflattenFromString(part);
                if (cn != null) out.add(cn.getPackageName());
            }
        } catch (Exception ignored) {
            // setarea poate fi indisponibilă pe unele ROM-uri; raportăm "niciun acces" fără a bloca scanarea
        }
        return out;
    }

    /** pachet -> true dacă serviciul poate citi conținutul ferestrelor (adică tot ce e pe ecran). */
    private static Map<String, Boolean> accessibility(Context ctx) {
        Map<String, Boolean> out = new HashMap<>();
        try {
            AccessibilityManager am = (AccessibilityManager) ctx.getSystemService(Context.ACCESSIBILITY_SERVICE);
            if (am == null) return out;
            List<AccessibilityServiceInfo> list =
                    am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK);
            if (list == null) return out;
            for (AccessibilityServiceInfo info : list) {
                ResolveInfo ri = info.getResolveInfo();
                if (ri == null || ri.serviceInfo == null) continue;
                boolean reads = (info.getCapabilities()
                        & AccessibilityServiceInfo.CAPABILITY_CAN_RETRIEVE_WINDOW_CONTENT) != 0;
                String pkg = ri.serviceInfo.packageName;
                Boolean prev = out.get(pkg);
                out.put(pkg, (prev != null && prev) || reads);
            }
        } catch (Exception ignored) {
            // idem
        }
        return out;
    }

    private static String assistantPackage(Context ctx) {
        String[] keys = {"assistant", "voice_interaction_service"};
        for (String k : keys) {
            try {
                String v = Settings.Secure.getString(ctx.getContentResolver(), k);
                if (v == null || v.isEmpty()) continue;
                ComponentName cn = ComponentName.unflattenFromString(v);
                if (cn != null) return cn.getPackageName();
            } catch (Exception ignored) {
                // cheie indisponibilă pe acest dispozitiv
            }
        }
        return null;
    }

    private static void fillPermissions(PackageManager pm, App a) {
        PackageInfo pi = packageInfo(pm, a.pkg);
        if (pi == null || pi.requestedPermissions == null) return;
        String[] req = pi.requestedPermissions;
        int[] flags = pi.requestedPermissionsFlags;
        for (int i = 0; i < req.length; i++) {
            String p = req[i];
            boolean granted = flags != null && i < flags.length
                    && (flags[i] & PackageInfo.REQUESTED_PERMISSION_GRANTED) != 0;
            String rt = RUNTIME.get(p);
            if (rt != null && granted) a.perms.add(rt);
            String sp = SPECIAL.get(p);
            if (sp != null) a.declared.add(sp);
        }
    }

    // Apelurile pe pachet, nu pe toată lista: evită TransactionTooLargeException pe telefoane cu multe aplicații.
    @SuppressWarnings("deprecation")
    private static List<ApplicationInfo> installedApps(PackageManager pm) {
        if (Build.VERSION.SDK_INT >= 33) {
            return pm.getInstalledApplications(PackageManager.ApplicationInfoFlags.of(0));
        }
        return pm.getInstalledApplications(0);
    }

    @SuppressWarnings("deprecation")
    private static PackageInfo packageInfo(PackageManager pm, String pkg) {
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                return pm.getPackageInfo(pkg, PackageManager.PackageInfoFlags.of(PackageManager.GET_PERMISSIONS));
            }
            return pm.getPackageInfo(pkg, PackageManager.GET_PERMISSIONS);
        } catch (Exception e) {
            return null;
        }
    }
}
