#!/usr/bin/env python3
# -*- encoding: utf-8 -*-

__author__ = 'Alex Sun'

'''
url handlers
'''

# import re, time, json, logging, hashlib, base64, asyncio

# # import markdown2

# from aiohttp import web

from coroweb import get, post
from apis import Page
from exceptions import APIValueError, APINidDuplicatedError, APINidNotExistedError

from models import BidNotices

# from models import User, Comment, Blog, next_id
# from config import configs

NOTICE_TYPE_CONFIG = {
    '0': '全部招标公告',
    '1': '单一来源采购公告',
    '2': '采购公告',
    '7': '中标结果公示',
    '3': '资格预审公告',
    '8': '供应商信息收集',
    '99': '供应商公告',
}

PAGE_SIZE = 10

def get_page_index(page_str):
    p = 1
    try:
        p = int(page_str)
    except ValueError:
        pass
    if p < 1:
        p = 1
    return p

@get('/')
def index():
    return {
        '__template__': 'index.html'
    }

@get('/hello')
def hello():
    return 'hello sss'

@get('/find')
async def find():
    page_index = get_page_index(1)
    num = await BidNotices.findNumber('count(nid)')
    # num = await BidNotices.findNumber()
    p = Page(num, page_index)
    if num == 0:
        return dict(page=p, comments=())
    notices = await BidNotices.findAll()
    return dict(page=p, notices=notices)
    

@get('/notice/pagination/{type_id}')
async def notice_page_view(type_id, *, page_id=1):
    """  View of /notice/pagination/[012378]/?page_id=1 """
    try:
        title = NOTICE_TYPE_CONFIG[type_id]
    except KeyError:
        raise APIValueError   # Unacceptable url para

    # 为了解决order by排序时内存溢出的问题，document的meta定义增加了index
    # if type_id == '0' or type_id is None:
    #     todos_page = BidNotice.objects(). \
    #         order_by("-published_date", "-timestamp"). \
    #         paginate(page=page_id, per_page=PAGE_SIZE)
    # else:
    #     todos_page = BidNotice.objects(type_id=type_id). \
    #         order_by("-published_date", "-timestamp"). \
    #         paginate(page=page_id, per_page=PAGE_SIZE)
    # page_index = get_page_index(page_id)
    # recs = await Notice.findNumber()
    # page = Page(recs)
    # if num == 0:
    #     blogs = []
    # else:
    #     blogs = yield from Blog.findAll(orderBy='created_at desc', limit=(page.offset, page.limit))
    # return {
    #     '__template__': 'blogs.html',
    #     'page': page,
    #     'blogs': blogs
    # }
    # num = BidNotices.objects.count()
    from sqlalchemy.orm import sessionmaker
    from models import __pool
    DBSession = sessionmaker(bind=__pool)

    session = DBSession()

    records = session.query(BidNotices).count()
    notices = session.query(BidNotices).order_by(
            BidNotices.published_date.desc(), BidNotices.timestamp.desc())
        # ).paginate(page=page_id, per_page=PAGE_SIZE)
    # p = Page(num, 1, 2)
    todos_page = {
        'total': records,
        'iter_pages': [1, 2, 3],
        'page': 1,
        'items': notices
    }

    session.close()

    return {
        '__template__': 'pagination.html',
        'todos_page': todos_page,
        'type_id': type_id,
        'title': title
    }




# app.add_url_rule('/', view_func=views.index)
# app.add_url_rule('/index.html', view_func=views.index)
# app.add_url_rule('/hello', view_func=views.hello)
# app.add_url_rule('/content/<string:nid>', view_func=views.content_view)
# app.add_url_rule('/notice/pagination/<string:type_id>', view_func=views.notice_page_view)
# app.add_url_rule('/chart01', view_func=charts.chart_view01)
# app.add_url_rule('/chart02', view_func=charts.chart_view02)
# app.add_url_rule('/chart03', view_func=charts.chart_view03)
# app.add_url_rule('/chart04', view_func=charts.chart_view04)