import sqlite3
from typing import Optional
from util import get_script_dir


class DB:
    def __init__(self):
        db_path = get_script_dir() / 'queue.db'
        self.db = sqlite3.connect(db_path)
        self.db.executescript('''
        CREATE TABLE IF NOT EXISTS reports (
            `submission_id` VARCHAR(10),
            `message_id` VARCHAR(20)
        );
        CREATE TABLE IF NOT EXISTS refresh_token (
            `token` VARCHAR(255)
        );
        ''')

    def add_report(self, submission_id: str, message_id: str):
        self.db.execute(
            'INSERT INTO reports (submission_id, message_id) VALUES (?, ?)',
            (submission_id, message_id),
        )
        self.db.commit()

    def is_report_added(self, submission_id: str):
        return self.db.execute(
            'SELECT rowid FROM reports WHERE submission_id = ?',
            (submission_id,)
        ).fetchone() is not None

    def get_message_id(self, submission_id: str):
        return self.db.execute(
            'SELECT message_id FROM reports WHERE submission_id = ?',
            (submission_id,)
        ).fetchone()[0]

    def mark_report_resolved(self, submission_id: str):
        self.db.execute(
            'DELETE FROM reports WHERE submission_id = ?',
            (submission_id,)
        )
        self.db.commit()

    def get_unresolved_reports(self):
        return self.db.execute('SELECT submission_id FROM reports').fetchall()

    def get_refresh_token(self) -> Optional[str]:
        row = self.db.execute('SELECT token FROM refresh_token').fetchone()
        return None if row is None else row[0]

    def set_refresh_token(self, refresh_token: str):
        self.db.execute('DELETE FROM refresh_token')
        self.db.execute(
            'INSERT INTO refresh_token (token) VALUES (?)',
            (refresh_token,)
        )
        self.db.commit()
