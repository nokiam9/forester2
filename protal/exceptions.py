#!/usr/bin/env python3
# -*- encoding: utf-8 -*-

__author__ = 'Alex Sun'

'''
API Error Definition
'''

class APIError(Exception):
    ''' 应用API的基础错误定义，包含: error(required), data(optional) and message(optional)
    '''
    def __init__(self, error, data='', message=''):
        super(APIError, self).__init__(message)
        self.error = error
        self.data = data
        self.message = message

class APINidNotExistedError(APIError):
    ''' 指定nid不存在
    '''
    def __init__(self, field, message=''):
        super(APINidNotExistedError, self).__init__('nid:not found', field, message)

class APINidDuplicatedError(APIError):
    ''' 指定nid已经存在
    '''
    def __init__(self, field, message=''):
        super(APINidDuplicatedError, self).__init__('nid:duplicated', field, message)

class APIValueError(APIError):
    '''
    Indicate the input value has error or invalid. The data specifies the error field of input form.
    '''
    def __init__(self, field, message=''):
        super(APIValueError, self).__init__('value:invalid', field, message)

# class APIResourceNotFoundError(APIError):
#     '''
#     Indicate the resource was not found. The data specifies the resource name.
#     '''
#     def __init__(self, field, message=''):
#         super(APIResourceNotFoundError, self).__init__('value:notfound', field, message)

# class APIPermissionError(APIError):
#     '''
#     Indicate the api has no permission.
#     '''
#     def __init__(self, message=''):
#         super(APIPermissionError, self).__init__('permission:forbidden', 'permission', message)


if __name__=='__main__':
    import doctest
    doctest.testmod()
