import configparser
import discord
import praw
import time
from praw.models import Comment, Subreddit, Submission
from praw.models.listing.mixins import subreddit
from db import DB
from util import get_script_dir


def get_config() -> configparser.ConfigParser:
    config_path = get_script_dir() / 'config.ini'
    config = configparser.ConfigParser()
    config.read(config_path)
    return config


def auth_to_reddit(config: configparser.ConfigParser, db: DB) -> Subreddit:
    refresh_token = db.get_refresh_token()
    reddit = praw.Reddit(
        client_id=config['Reddit']['ClientID'],
        client_secret=config['Reddit']['ClientSecret'],
        redirect_uri='https://kocka.tech',
        user_agent='r/UndertaleYellow mod queue relay by u/KockaAdmiralac',
        refresh_token=refresh_token
    )
    if refresh_token is None:
        print('Use the URL: ', reddit.auth.url(
            scopes=['read'],
            state='123',
            duration='permanent'
        ))
        code = input('Give the code: ')
        refresh_token = reddit.auth.authorize(code)
        if refresh_token is not None:
            db.set_refresh_token(refresh_token)
    return reddit.subreddit(config['Reddit']['Subreddit'])


def get_webhook(config: configparser.ConfigParser) -> discord.SyncWebhook:
    return discord.SyncWebhook.from_url(config['Discord']['Webhook'])


def create_comment_em(submission: Comment) -> discord.Embed:
    reports = submission.mod_reports + submission.user_reports
    report_string = '\n'.join([f'{r[1]}: {r[0]}' for r in reports])
    return discord.Embed(
        title=f'Comment by {submission.author}',
        description=f'{submission.body}\n\n{report_string}',
        url=f'https://reddit.com{submission.permalink}',
        color=0xEEEEEE,
    ).set_author(name='u/{}'.format(submission.author))


def create_post_em(post: Submission) -> discord.Embed:
    reports = submission.mod_reports + submission.user_reports
    report_string = '\n'.join([f'{r[1]}: {r[0]}' for r in reports])
    if post.is_self:
        title_string = post.title
    else:
        title_string = f'{post.title} ({post.domain})'
    em = discord.Embed(
        title=title_string,
        description=report_string,
        url='https://redd.it/{}'.format(post.id),
        color=0x00BCD4,
    ).set_author(name='u/{}'.format(post.author))
    if not post.is_self and hasattr(post, 'preview'):
        em.set_thumbnail(
            url=post.preview['images'][0]['resolutions'][0]['url']
        )
    return em


if __name__ == '__main__':
    config = get_config()
    db = DB()
    subreddit = auth_to_reddit(config, db)
    webhook = get_webhook(config)
    while True:
        try:
            current_report_ids = []
            for submission in subreddit.mod.modqueue():
                current_report_ids.append(submission.id)
                if db.is_report_added(submission.id):
                    continue
                if isinstance(submission, Comment):
                    em = create_comment_em(submission)
                else:
                    em = create_post_em(submission)
                msg = webhook.send(embed=em, wait=True)
                db.add_report(submission.id, str(msg.id))
            unresolved_reports = db.get_unresolved_reports()
            resolved_reports = []
            for report in unresolved_reports:
                if report[0] not in current_report_ids:
                    resolved_reports.append(report[0])
            for report_id in resolved_reports:
                webhook.delete_message(db.get_message_id(report_id))
                db.mark_report_resolved(report_id)
            time.sleep(10)
        except KeyboardInterrupt:
            break
