#!/usr/bin/env python3
# -*- encoding: utf-8 -*-

__author__ = 'Alex Sun'

'''
Main: async web application
'''

import logging; logging.basicConfig(level=logging.INFO)
import asyncio, os, json, time

from datetime import datetime
from aiohttp import web
from jinja2 import Environment, FileSystemLoader

from config import configs
# import orm
from coroweb import add_routes, add_static

def init_jinja2(app, **kw):
    ''' 根据环境变量初始化jinja2 
    '''
    logging.info('init jinja2...')
    options = dict(
        autoescape = kw.get('autoescape', True),
        block_start_string = kw.get('block_start_string', '{%'),
        block_end_string = kw.get('block_end_string', '%}'),
        variable_start_string = kw.get('variable_start_string', '{{'),
        variable_end_string = kw.get('variable_end_string', '}}'),
        auto_reload = kw.get('auto_reload', True)
    )
    path = kw.get('path', None)
    if path is None:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates')
    logging.info('set jinja2 template path: %s' % path)
    env = Environment(loader=FileSystemLoader(path), **options)
    filters = kw.get('filters', None)
    if filters is not None:
        for name, f in filters.items():
            env.filters[name] = f
    app['__templating__'] = env

async def logger_factory(app, handler):
    """自定义logger钩子函数
    """
    async def logger(request):
        logging.info('Request: %s %s' % (request.method, request.path))
        # yield from asyncio.sleep(0.3)
        return (await handler(request))
    return logger

async def data_factory(app, handler):
    """自定义request钩子函数，没找到调用？
    """
    async def parse_data(request):
        if request.method == 'POST':
            if request.content_type.startswith('application/json'):
                request.__data__ = await request.json()
                logging.info('request json: %s' % str(request.__data__))
            elif request.content_type.startswith('application/x-www-form-urlencoded'):
                request.__data__ = await request.post()
                logging.info('request form: %s' % str(request.__data__))
        return (await handler(request))
    return parse_data

async def response_factory(app, handler):
    """自定义response钩子函数：根据handler的返回值构造web.Response
    """
    async def response(request):
        logging.info('Response handler...')
        r = await handler(request)              # 异步执行handler，获得处理结果r
    
        if isinstance(r, web.StreamResponse):   # 已经是web.Response，直接返回
            return r   
        if isinstance(r, bytes):                # 返回字节流，通常是文件下载
            resp = web.Response(body=r)
            resp.content_type = 'application/octet-stream'
            return resp
        if isinstance(r, str):                  # 返回字符串，一般是html文件，
            if r.startswith('redirect:'):       # 发现重定向，提取url地址
                return web.HTTPFound(r[9:])
            resp = web.Response(body=r.encode('utf-8'))
            resp.content_type = 'text/html;charset=utf-8'
            return resp
        # 返回一个字典，可能是html模版或者json数据
        if isinstance(r, dict):
            template = r.get('__template__')
            if template is None:    # API的JSON数据包
                resp = web.Response(
                    body=json.dumps(r, ensure_ascii=False,  default=lambda o: o.__dict__).encode('utf-8')
                )
                resp.content_type = 'application/json;charset=utf-8'
                return resp
            else:   # jinja2模版
                resp = web.Response(
                    body=app['__templating__'].get_template(template).render(**r).encode('utf-8')
                )
                resp.content_type = 'text/html;charset=utf-8'
                return resp
        # 返回http错误码
        if isinstance(r, int) and r >= 100 and r < 600:    
            return web.Response(status=r)
        # 返回（http错误码 + 错误信息）
        if isinstance(r, tuple) and len(r) == 2:
            t, m = r
            if isinstance(t, int) and t >= 100 and t < 600:
                return web.Response(status=t, body=str(m))
        # default:
        resp = web.Response(body=str(r).encode('utf-8'))
        resp.content_type = 'text/plain;charset=utf-8'
        return resp
    return response

def datetime_filter(t):
    """为Jinja2设置时间格式的过滤器 """
    import time
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(t))

async def init(loop):
    """初始化web.server
    """
    await orm.create_pool(loop=loop, **configs['db'])
    # 创建web服务器实例，并加载几个中间件
    app = web.Application(loop=loop, middlewares=[
        logger_factory, response_factory
    ])
    # 加载jinja2，包含一个过滤器
    init_jinja2(app, filters=dict(datetime=datetime_filter))
    # 为route路径注册处理函数
    add_routes(app, 'handlers')
    add_static(app)
    # 返回一个创建好的,绑定IP和端口以及http协议簇的监听服务的协程
    srv = await loop.create_server(app.make_handler(), '127.0.0.1', 3000)
    logging.info('server started at http://127.0.0.1:3000...')
    return srv

# Main入口
loop = asyncio.get_event_loop()     # 生成一个事件循环实例 
loop.run_until_complete(init(loop)) # 对loop进行了初始化, 创建了tcp server
loop.run_forever()                  # 一直运行
