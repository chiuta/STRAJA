package tf.trom.straja;

import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StrajaPlugin.class);
        super.onCreate(savedInstanceState);
        // Implicit, conținutul STRAJA nu poate fi capturat sau citit de asistenți/agenți AI.
        if (getSharedPreferences(Watcher.PREFS, MODE_PRIVATE).getBoolean("secure", true)) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        }
    }
}
