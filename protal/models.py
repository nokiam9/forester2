#!/usr/bin/env python3
# -*- encoding: utf-8 -*-

__author__ = 'Alex Sun'

'''
Models by Mysql
'''

import time, uuid

from orm import Model, StringField, BooleanField, FloatField, TextField

class BidNotices(Model):
    __table__ = 'BidNotices'

    nid = StringField(primary_key=True, ddl='varchar(20)')      # 主键
    title = StringField(ddl='varchar(100)')
    notice_type = StringField(ddl='varchar(20)')
    source_ch = StringField(ddl='varchar(20)')
    notice_url = StringField(ddl='varchar(256)')
    notice_content = TextField                                  # length < 64K
    published_date = FloatField(default=time.time)
    timestamp = FloatField(default=time.time)
    reminded_time = FloatField(default=time.time)
    type_id = StringField(ddl='varchar(20)')
    spider = StringField(ddl='varchar(20)')
    # attachment_urls = StringField(ddl='varchar(20)')
    # attachment_files = db.ListField(required=False)

