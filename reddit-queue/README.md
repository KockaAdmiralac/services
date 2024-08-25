# reddit-queue
A modified version of [kokobot](https://github.com/rkpop/kokobot) for use on
[r/UndertaleYellow](https://www.reddit.com/r/UndertaleYellow/). It relays
reported posts and comments from the subreddit queue through a Discord webhook
into a channel, and deletes them once they are resolved.

## Setup
```bash
# Set up a virtual environment
python -m venv .venv
source .venv/bin/activate
# Install dependencies
pip install -r requirements.txt
# ... do configuration here ...
# Run the bot
python main.py
```

## Configuration
Sample configuration provided in `config.sample.ini`. You will need to create a
[Discord webhook](https://support.discord.com/hc/articles/228383668) and a
[Reddit application](https://www.reddit.com/prefs/apps) (select "script" and
for the redirect URI enter any website's homepage), and put the details of both
the webhook and the application into the required fields in the configuration.

Upon starting, the program asks you to visit a link to authorize the
application. You will then be redirected to
`[redirect URI]/?state=123&code=[OAuth2 code goes here]#_`, and you should
grab that code from the URL and input it into the program.
