package tf.trom.straja;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Compară starea curentă a accesului cu o stare de referință și alertează la orice acces nou. */
final class Watcher {
    static final String PREFS = "straja";
    static final String CHANNEL = "straja_watch";
    private static final String K_BASE = "baseline";
    private static final String K_EVENTS = "events";
    private static final String K_TEXTS = "texts";
    private static final int MAX_EVENTS = 100;
    private static final int NOTIF_ID = 7301;

    private Watcher() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Texte localizate pentru notificări, trimise de interfață: title, channel, kind.<tip>. */
    static void setTexts(Context c, JSONObject texts) {
        if (texts != null) prefs(c).edit().putString(K_TEXTS, texts.toString()).apply();
    }

    private static String tx(Context c, String key, String fallback) {
        try {
            JSONObject o = new JSONObject(prefs(c).getString(K_TEXTS, "{}"));
            String v = o.optString(key, "");
            return v.isEmpty() ? fallback : v;
        } catch (Exception e) {
            return fallback;
        }
    }

    static boolean hasBaseline(Context c) {
        return prefs(c).contains(K_BASE);
    }

    static void saveBaseline(Context c) {
        Set<String> sig = AccessScanner.signals(AccessScanner.scan(c));
        prefs(c).edit().putStringSet(K_BASE, new HashSet<>(sig)).apply();
    }

    /** Returnează evenimentele noi (acces apărut de la ultima verificare) și actualizează referința. */
    static synchronized List<JSONObject> check(Context c, boolean notify) {
        List<JSONObject> fresh = new ArrayList<>();
        AccessScanner.Result r = AccessScanner.scan(c);
        Set<String> now = AccessScanner.signals(r);
        SharedPreferences p = prefs(c);
        Set<String> base = p.getStringSet(K_BASE, null);
        if (base == null) { // prima rulare: stabilim referința, fără alerte
            p.edit().putStringSet(K_BASE, new HashSet<>(now)).apply();
            return fresh;
        }
        Map<String, AccessScanner.App> apps = AccessScanner.byPackage(r);
        long t = System.currentTimeMillis();
        for (String s : now) {
            if (base.contains(s)) continue;
            int i = s.indexOf('|');
            String pkg = s.substring(0, i);
            String kind = s.substring(i + 1);
            AccessScanner.App a = apps.get(pkg);
            try {
                JSONObject e = new JSONObject();
                e.put("t", t);
                e.put("pkg", pkg);
                e.put("label", a != null ? a.label : pkg);
                e.put("kind", kind);
                fresh.add(e);
            } catch (Exception ignored) {
                // JSONObject.put nu poate eșua pe chei/valori simple
            }
        }
        p.edit().putStringSet(K_BASE, new HashSet<>(now)).apply();
        if (!fresh.isEmpty()) {
            appendEvents(p, fresh);
            if (notify) notifyUser(c, fresh);
        }
        return fresh;
    }

    static JSONArray events(Context c) {
        try {
            return new JSONArray(prefs(c).getString(K_EVENTS, "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    static void clearEvents(Context c) {
        prefs(c).edit().remove(K_EVENTS).apply();
    }

    private static void appendEvents(SharedPreferences p, List<JSONObject> fresh) {
        try {
            JSONArray old = new JSONArray(p.getString(K_EVENTS, "[]"));
            JSONArray out = new JSONArray();
            for (JSONObject e : fresh) out.put(e);
            for (int i = 0; i < old.length() && out.length() < MAX_EVENTS; i++) out.put(old.get(i));
            p.edit().putString(K_EVENTS, out.toString()).apply();
        } catch (Exception ignored) {
            // jurnal indisponibil; alerta se trimite oricum
        }
    }

    private static String kindName(Context c, String kind) {
        String def;
        switch (kind) {
            case "notif": def = "notification access"; break;
            case "a11y": def = "accessibility service"; break;
            case "assistant": def = "default digital assistant"; break;
            case "perm:images": case "perm:video": case "perm:storage": def = "photo/video access"; break;
            case "perm:sms": def = "SMS access"; break;
            case "perm:calllog": def = "call-log access"; break;
            default: def = kind;
        }
        return tx(c, "kind." + kind.replace(':', '_'), def);
    }

    private static void notifyUser(Context c, List<JSONObject> fresh) {
        try {
            if (Build.VERSION.SDK_INT >= 33
                    && c.checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                    != PackageManager.PERMISSION_GRANTED) {
                return; // evenimentul rămâne în jurnal
            }
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel ch = new NotificationChannel(CHANNEL,
                        tx(c, "channel", "Access alerts"), NotificationManager.IMPORTANCE_HIGH);
                nm.createNotificationChannel(ch);
            }
            StringBuilder body = new StringBuilder();
            for (int i = 0; i < fresh.size() && i < 4; i++) {
                JSONObject e = fresh.get(i);
                if (i > 0) body.append('\n');
                body.append(e.optString("label")).append(": ").append(kindName(c, e.optString("kind")));
            }
            if (fresh.size() > 4) body.append("\n+").append(fresh.size() - 4);

            Intent launch = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
            PendingIntent pi = launch == null ? null
                    : PendingIntent.getActivity(c, 0, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

            int icon = c.getResources().getIdentifier("ic_stat_straja", "drawable", c.getPackageName());
            if (icon == 0) icon = android.R.drawable.ic_dialog_alert;

            Notification.Builder b = Build.VERSION.SDK_INT >= 26
                    ? new Notification.Builder(c, CHANNEL)
                    : legacyBuilder(c);
            b.setSmallIcon(icon)
                    .setContentTitle(tx(c, "title", "STRAJA: new access detected"))
                    .setContentText(body.toString().split("\n")[0])
                    .setStyle(new Notification.BigTextStyle().bigText(body.toString()))
                    .setAutoCancel(true);
            if (pi != null) b.setContentIntent(pi);
            nm.notify(NOTIF_ID, b.build());
        } catch (Exception ignored) {
            // notificarea e best-effort
        }
    }

    @SuppressWarnings("deprecation")
    private static Notification.Builder legacyBuilder(Context c) {
        Notification.Builder b = new Notification.Builder(c);
        b.setPriority(Notification.PRIORITY_HIGH);
        return b;
    }
}
