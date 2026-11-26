package tf.trom.straja;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.WindowManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.List;

@CapacitorPlugin(name = "Straja")
public class StrajaPlugin extends Plugin {

    @PluginMethod
    public void info(PluginCall call) {
        JSObject o = new JSObject();
        o.put("sdk", Build.VERSION.SDK_INT);
        o.put("manufacturer", Build.MANUFACTURER);
        o.put("model", Build.MODEL);
        call.resolve(o);
    }

    @PluginMethod
    public void scan(PluginCall call) {
        try {
            AccessScanner.Result r = AccessScanner.scan(getContext());
            JSArray apps = new JSArray();
            for (AccessScanner.App a : r.apps) {
                JSObject o = new JSObject();
                o.put("pkg", a.pkg);
                o.put("label", a.label);
                o.put("system", a.system);
                o.put("notif", a.notif);
                o.put("a11y", a.a11y);
                o.put("readsScreen", a.readsScreen);
                o.put("assistant", a.assistant);
                JSArray perms = new JSArray();
                for (String p : a.perms) perms.put(p);
                o.put("perms", perms);
                JSArray decl = new JSArray();
                for (String p : a.declared) decl.put(p);
                o.put("declared", decl);
                apps.put(o);
            }
            JSObject out = new JSObject();
            out.put("apps", apps);
            out.put("assistantPkg", r.assistantPkg == null ? "" : r.assistantPkg);
            out.put("ts", System.currentTimeMillis());
            call.resolve(out);
        } catch (Exception e) {
            call.reject("scan_failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        String target = call.getString("target", "app");
        String pkg = call.getString("pkg", "");
        Intent i;
        switch (target) {
            case "notifications":
                i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
                break;
            case "accessibility":
                i = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
                break;
            case "assistant":
                i = new Intent(Settings.ACTION_VOICE_INPUT_SETTINGS);
                break;
            case "privacy":
                i = new Intent(Settings.ACTION_PRIVACY_SETTINGS);
                break;
            case "files":
                i = Build.VERSION.SDK_INT >= 30
                        ? new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                        : new Intent(Settings.ACTION_INTERNAL_STORAGE_SETTINGS);
                break;
            case "overlay":
                i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
                break;
            default:
                if (pkg == null || pkg.isEmpty()) {
                    call.reject("missing_pkg");
                    return;
                }
                i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception first) {
            try {
                Intent s = new Intent(Settings.ACTION_SETTINGS);
                s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(s);
                call.resolve();
            } catch (Exception second) {
                call.reject("settings_unavailable");
            }
        }
    }

    // ---- monitorizare ----

    @PluginMethod
    public void watch(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", true));
        if (enabled) {
            Integer m = call.getInt("minutes", 30);
            int minutes = m == null ? 30 : m;
            if (!Watcher.hasBaseline(getContext())) Watcher.saveBaseline(getContext());
            boolean ok = WatchJobService.schedule(getContext(), minutes);
            if (!ok) {
                call.reject("schedule_failed");
                return;
            }
        } else {
            WatchJobService.cancel(getContext());
        }
        watchStatus(call);
    }

    @PluginMethod
    public void setTexts(PluginCall call) {
        Watcher.setTexts(getContext(), call.getObject("texts"));
        call.resolve();
    }

    @PluginMethod
    public void watchStatus(PluginCall call) {
        JSObject o = new JSObject();
        o.put("watching", WatchJobService.isScheduled(getContext()));
        o.put("hasBaseline", Watcher.hasBaseline(getContext()));
        call.resolve(o);
    }

    @PluginMethod
    public void checkNow(PluginCall call) {
        List<JSONObject> fresh = Watcher.check(getContext(), false);
        JSArray arr = new JSArray();
        for (JSONObject e : fresh) arr.put(e);
        JSObject o = new JSObject();
        o.put("events", arr);
        call.resolve(o);
    }

    @PluginMethod
    public void events(PluginCall call) {
        JSObject o = new JSObject();
        o.put("events", Watcher.events(getContext()));
        call.resolve(o);
    }

    @PluginMethod
    public void clearEvents(PluginCall call) {
        Watcher.clearEvents(getContext());
        call.resolve();
    }

    @PluginMethod
    public void acceptBaseline(PluginCall call) {
        Watcher.saveBaseline(getContext());
        call.resolve();
    }

    // ---- ecranul propriu: împiedică capturile și citirea lui de către asistenți/agenți ----

    @PluginMethod
    public void setSecure(PluginCall call) {
        final boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", true));
        Watcher.prefs(getContext()).edit().putBoolean("secure", enabled).apply();
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (enabled) {
                    getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
                } else {
                    getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                }
            }
        });
        JSObject o = new JSObject();
        o.put("secure", enabled);
        call.resolve(o);
    }

    @PluginMethod
    public void getSecure(PluginCall call) {
        JSObject o = new JSObject();
        o.put("secure", Watcher.prefs(getContext()).getBoolean("secure", true));
        call.resolve(o);
    }
}
