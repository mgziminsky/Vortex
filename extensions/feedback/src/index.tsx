import { addFeedbackFile } from './actions/session';
import { sessionReducer } from './reducers/session';
import { IFeedbackFile } from './types/IFeedbackFile';

import FeedbackView from './views/FeedbackView';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as path from 'path';
import { fs, selectors, tooltip, types, util } from 'vortex-api';

function findCrashDumps() {
  const nativeCrashesPath = path.join(remote.app.getPath('userData'), 'temp', 'dumps');

  return fs.readdirAsync(nativeCrashesPath)
    .filter((filePath: string) => path.extname(filePath) === '.dmp')
    .map((iterPath: string) => path.join(nativeCrashesPath, iterPath));
}

function nativeCrashCheck(context: types.IExtensionContext): Promise<void> {
  return findCrashDumps()
    .then(crashDumps => {
      if (crashDumps.length > 0) {
        context.api.sendNotification({
          type: 'error',
          title: 'Vortex Crashed!',
          message: 'It appears the last session of vortex crashed (You probably noticed...)',
          actions: [
            {
              title: 'Send Report',
              action: dismiss => {
                return Promise.map(crashDumps,
                  dump => fs.statAsync(dump).then(stats => ({ filePath: dump, stats })))
                  .each((iter: { filePath: string, stats: fs.Stats }) => {
                    const feedbackFile: IFeedbackFile = {
                      filename: path.basename(iter.filePath),
                      filePath: iter.filePath,
                      size: iter.stats.size,
                      type: 'Dump',
                    };

                    context.api.store.dispatch(addFeedbackFile(feedbackFile));
                  })
                  .then(() => {
                    context.api.events.emit('show-main-page', 'Feedback');
                    dismiss();
                  });
              },
            },
          ],
        });
      }
    });
}

function init(context: types.IExtensionContext) {
  context.registerMainPage('', 'Feedback', FeedbackView, {
    hotkey: 'F',
    group: 'hidden',
  });

  context.registerAction('global-icons', 100, 'feedback', {}, 'Send Feedback', () =>
    context.api.events.emit('show-main-page', 'Feedback'));

  context.registerReducer(['session', 'feedback'], sessionReducer);

  context.once(() => {
    context.api.setStylesheet('feedback', path.join(__dirname, 'feedback.scss'));

    context.api.events.on('report-log-error',
      (logSessionPath: string) => {

        fs.statAsync(logSessionPath)
          .then((stats) => {
            const fileSize = stats.size / 1024 !== 0 ? Math.round(stats.size / 1024) : 1;
            const feedbackFile: IFeedbackFile = {
              filename: path.basename(logSessionPath),
              filePath: logSessionPath,
              size: fileSize,
              type: 'log',
            };
            context.api.store.dispatch(addFeedbackFile(feedbackFile));
          });
        context.api.events.emit('show-main-page', 'Feedback');
      });

    nativeCrashCheck(context);
  });

  return true;
}

export default init;
