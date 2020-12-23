#!/usr/bin/env python3
# -*- encoding: utf-8 -*-

__author__ = 'Alex Sun'

'''
Define data model of user table with sqlalchemy
'''

from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, JSON, Index

Base = declarative_base()

def create_pool(uri):
    '''创建全局的SQLAlchemy连接池，并自动创建DB。
        注意：依赖于sqlalchemy_utils
    '''
    from sqlalchemy import create_engine
    from sqlalchemy_utils import database_exists, create_database
    import logging

    global __pool

    __pool = create_engine(uri, pool_size=20, encoding='utf8', echo=True)
    if not database_exists(__pool.url):
        logging.info('Auto create user database...')
        create_database(__pool.url)

class BidNotices (Base):
    __tablename__ = 'BidNotices'

    __table_args__ = (
        # Todo: 索引配置信息，未来考虑复合索引
        # Index('idx01', 'published_date', 'timestamp'),
        # Index('idx02', 'timestamp'),
        # Index('idx03', 'type_id'),
        # 设置引擎和字符集，注意：这个map只能放到元组的最后，否则会报错
        {
            'mysql_engine': 'InnoDB',
            'mysql_charset': 'utf8',
        }
    )

    _id = Column(Integer, autoincrement=True, primary_key=True)  # 主键_id
    nid = Column(String(256), unique=True, index=True)           # 唯一
    title = Column(String(256), nullable=False)
    type_id = Column(String(256), nullable=False, index=True)
    spider = Column(String(256), nullable=False)
    notice_type = Column(String(256), nullable=False)
    source_ch = Column(String(256), nullable=False)
    notice_url = Column(String(256), nullable=False)
    published_date = Column(Integer, nullable=False, index=True)
    timestamp = Column(Integer, default=0, index=True)          # 默认是当前时间
    reminded_time = Column(Integer, default=0, index=True)      # 预留给XS，可能为空
    notice_content = Column(Text, default='')                   # lenth(Text) < 64K
    attachments = Column(JSON, default={})                      # 预留给附件，可能为空

    def __repr__(self):
        return '<nid=%s, title=%s>' % (self.nid, self.title)
