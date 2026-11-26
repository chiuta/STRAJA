package tf.trom.straja;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;

/** Verificare periodică (persistentă după repornire) a accesului acordat aplicațiilor. */
public class WatchJobService extends JobService {
    static final int JOB_ID = 7301;

    @Override
    public boolean onStartJob(final JobParameters params) {
        final Context app = getApplicationContext();
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    Watcher.check(app, true);
                } catch (Throwable ignored) {
                    // nu lăsăm jobul să cadă
                } finally {
                    jobFinished(params, false);
                }
            }
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true;
    }

    static boolean schedule(Context c, int minutes) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return false;
        long ms = Math.max(minutes * 60_000L, JobInfo.getMinPeriodMillis());
        JobInfo info = new JobInfo.Builder(JOB_ID, new ComponentName(c, WatchJobService.class))
                .setPeriodic(ms)
                .setPersisted(true)
                .build();
        return js.schedule(info) == JobScheduler.RESULT_SUCCESS;
    }

    static void cancel(Context c) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js != null) js.cancel(JOB_ID);
    }

    static boolean isScheduled(Context c) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        return js != null && js.getPendingJob(JOB_ID) != null;
    }
}
