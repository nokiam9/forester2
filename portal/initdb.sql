drop database if exists cmccb2b;

create database cmccb2b;

use cmccb2b;

-- grant select, insert, update, delete on cmccb2b.* to 'www'@'%' identified by 'www-data';

CREATE TABLE  BidNotices (
    `spider` varchar(20) not null,
    `type_id` varchar(20) not null,
    `nid` varchar(20) not null,
    `title` varchar(100) not null,
    `notice_type` varchar(20) not null,
    `source_ch` varchar(20) not null,
    `notice_url` varchar(256) not null,
    `notice_content` text,
    `published_date` float,
    `timestamp` float,
    `reminded_time` float,
    INDEX `idx_type` (`type_id`),
    primary key (`nid`)
) engine=innodb default charset=utf8;
