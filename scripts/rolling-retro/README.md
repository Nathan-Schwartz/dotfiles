This script prompts you on an interval with the intention of helping you improve your work habits.

### Summary
The idea is that each session of `interval` length is followed by a retro in the form of CLI prompts. After the prompts are completed, the next retro is scheduled.

### Details
A countdown is shown beween retros. When it is time for retro some CLI prompts are shown. On Mac a notification will be sent as a reminder at the start of the retro.

The questions are intended to be thought provoking and short. I intend to keep the time requirement per retro in the 20s to 3 minutes range.

Answers are stored in `~/.rolling-retro.output` by default. Answers are stored as JSON and appended to the file, I've included a naive parser in `/parser.js` if you want to analyze your historical answers. I may build out some analytics in the future.

I source the following script to set up a single instance of rolling-retro in the background when I open a new terminal window.
```bash
tmux new-session -s rolling-retro -d 'cd ~/dotfiles/scripts/rolling-retro && yarn start' 2> /dev/null || true
```
