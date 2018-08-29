const inquirer = require('inquirer');
const program = require('commander');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const sleep = promisify(setTimeout);

program
  .option(
    '--recurring-interval-minutes <recurring-interval-minutes>',
    'Run retros on an interval of the specified number of minutes.',
  )
  .option('--dont-save', 'Do not record answers to prompts.')
  .option('--remind-aggressively', 'Send alerts every minute if user hasn\'t answered the first retro prompt.')
  .parse(process.argv);

function run() {
  // Could change this function to use a DB instead
  const persistOutput = (output) => {
    const storageFile = path.resolve(require('os').homedir(), '.rolling-retro.output');

    fs.appendFileSync(storageFile, JSON.stringify(output) + '\n', 'utf8');
  }

  // This could be made more or less invasive
  // TODO: Check if mac?
  const sendAlert = () => exec(`osascript -e 'display notification "Please post an update :)" with title "RollingRetro" sound name "Submarine"'`);


  //
  // Rolling Retro source
  //
  const exec = (command) =>
    new Promise((resolve, reject) => {
      require('child_process')
        .spawn(command, { stdio: 'inherit', shell: true })
        .on('exit', (code, signal) => {
          if (code !== 0) process.exit(code);
          return resolve(code, signal);
        })
        .on('error', reject);
    });

  // TODO: Don't use console.log so we can write over prior output instead of needing to clear it
  const clear = () => exec('clear');
  const printCountdown = async (tickCount) => {
    await clear();
    const remainingTicks = sessionIntervalSeconds - tickCount;
    const remainingSeconds = Math.round((remainingTicks * 1000) / 1000);
    const remainingMin = Math.floor(remainingSeconds / 60);

    const prettySeconds = (function() {
      const leftoverSeconds = remainingSeconds % 60;
      return leftoverSeconds < 10 ? `0${leftoverSeconds}` : leftoverSeconds;
    })()

    const outputTime = remainingMin > 0
      ? `${remainingMin}:${prettySeconds} minutes`
      : `${remainingSeconds} seconds`;

    console.log(`\n  Next retro in ${outputTime}.`);
  }


  const runRetro = async () => {
    const startedAt = Date.now();
    await clear();

    let intervalKey;

    if (program.remindAggressively) {
      await sendAlert();
      intervalKey = setInterval(sendAlert, 60 * 1000);
    }

    const answers = await inquirer.prompt([
      {
        name: 'productivity',
        message: 'Rate the productivity of your session (0-9):',
        type: 'input',
        validate: (input) => {
          // User has started the survey, stop reminding them
          if (program.remindAggressively) {
            clearInterval(intervalKey);
          }

          const valid = Array(10).fill().map((a, i) => i).includes(Number(input));

          return valid ? true : 'Answer must be a number between 0-9';
        },
      },
      {
        name: 'went-well-details',
        message: 'What went well?',
        type: 'editor',
      },
      {
        name: 'went-poorly-details',
        message: 'What could be going better?',
        // TODO: Should this be mandatory?
        when: (input) => Number(input['productivity']) < 5,
        type: 'editor',
      },
      {
        name: 'session-activities',
        message: 'What were you working on?',
        choices: ['coordinating', 'code review', 'whiteboarding', 'coding'],
        type: 'checkbox',
      },
      {
        name: 'wants-to-reflect-on-problem',
        message: 'Do you want to reflect on the problem(s) from the session?',
        type: 'confirm',
      },
      {
        name: 'is-most-effective-approach',
        message: 'Is your current approach the fastest route to a satisfactory solution?',
        when: (input) => input['wants-to-reflect-on-problem'],
        type: 'confirm',
      },
      {
        name: 'identified-new-tradeoff',
        message: 'Have you identified any new tradeoffs for the problem(s) or your solution(s)?',
        when: (input) => input['wants-to-reflect-on-problem'],
        type: 'confirm',
      },
      {
        name: 'tradeoff-details',
        message: 'Describe the trade-offs.',
        when: (input) => input['identified-new-tradeoff'],
        type: 'editor',
      },
      {
        name: 'identified-new-blindspot',
        message: 'Have you identified any areas of the problem(s) that should be researched more?',
        when: (input) => input['wants-to-reflect-on-problem'],
        type: 'confirm',
      },
      {
        name: 'blindspot-details',
        message: 'Describe any areas that need discovery.',
        when: (input) => input['identified-new-blindspot'],
        type: 'editor',
      },
      {
        name: 'should-pivot',
        message: 'Should you pivot to another part of the problem, or a different problem?',
        when: (input) => input['wants-to-reflect-on-problem'],
        type: 'confirm',
      },
      {
        name: 'has-final-comment',
        message: 'Would you like to mention any other progress or comments?',
        type: 'confirm',
      },
      {
        name: 'has-final-comment-details',
        message: 'Describe any notes or progress you\'d like.',
        when: (input) => input['has-final-comment'],
        type: 'editor',
      },
      {
        name: 'the-plan',
        message: 'Describe the plan for the next session.',
        type: 'editor',
      } ]);

    console.log('Thanks!');
    console.log('Drink some water :)');

    const completedAt = Date.now();
    const timeSpentAnsweringMilliseconds = completedAt - startedAt;

    if (!program.dontSave) {
      await persistOutput({ answers, meta: { timeSpentAnsweringMilliseconds, completedAt } });
    }
    await sleep(3000);
  }

  let counter = 0;
  let gatheringInfo = false;
  const sessionIntervalSeconds = program.recurringIntervalMinutes ? program.recurringIntervalMinutes * 60 : 0;

  const main = async() => {
    // We don't start the timer on the next session until we are done gathering info.
    if (gatheringInfo) return;

    counter += 1;

    if (counter === sessionIntervalSeconds) {
      gatheringInfo = true;
      await runRetro()
      gatheringInfo = false;
      counter = 0;
    }

    printCountdown(counter);
  }

  if (program.recurringIntervalMinutes) {
    setInterval(main, 1000);
  } else {
    runRetro();
  }
}

run();
