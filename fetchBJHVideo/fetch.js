'use strict';

var request = require('superagent');
var cheerio = require('cheerio');
var async = require('async');
var URL = require('url');
var fs = require('fs');
var path = require('path');
var fetchlog = require('debug')('fetch');
//要爬虫的网站
var bjhVideoUrl = 'https://baijia.baidu.com/';
var titleJsons = [];
function startFetch() {

    request
    .get(bjhVideoUrl)
    .end((err,res)=> {
        if(err) {
            console.log(err);
            return;
        }
        decodeHeaderUrl(res);
    });
}

function decodeHeaderUrl(res){
    var headerUrls = [];
    var $ = cheerio.load(res.text);
    $('#header-wrapper .bjh-header-content .bjh-header-list li a').each((idx,element)=> {
        var href = $(element).attr('href');
        var title = $(element).text().trim();
        var headerJson = {
            'href':href,
            'title':title
        };
        titleJsons.push(headerJson);
        var url = URL.resolve(bjhVideoUrl,href);
        console.log(url);
        headerUrls.push(url);
    });

    async.mapLimit(headerUrls,2,function(url,cb){
        requestByTitle(url,cb);
    },function(err,result){
        console.log('fetch data success! fetch data count ' + result.length);
        try {
            fs.writeFileSync(path.join(__dirname,'db.json'),JSON.stringify(result,null,2),{'flag':'a'});
            console.log('save fetch data to db.json success!');
        } catch (error) {
            console.log('save fetch data to db.json fail!');
        }
    });
}

function requestByTitle(url,cb) {
    request
    .get(url)
    .set({
        'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36'
    })
    .end((err,res)=> {
        if (err) {
            console.log(err);
            var videoJson = createResult(url,null);
            cb(null,videoJson);
            return;
        }
        var videoJsons = [];
        var $ = cheerio.load(res.text);
        var artEle = $('#articleList')
        artEle.children().each((idx,element)=> {
            var className = $(element).attr('class');
            if (className === 'article-info'){
                var imgEle = $(element).find('img');
                var imgSrc = $(imgEle).attr('src');
                var titleEle = $(element).find('.title').children()[0];
                var title = $(titleEle).text().trim();
                var authorEle = $(element).find('.author').children()[0];
                var author = $(authorEle).text().trim();
                var otherEle = $(element).find('.author').children()[1];
                var other = $(otherEle).text().trim();
                var titleJson = {
                    'type':className,
                    'images':[imgSrc],
                    'title':title,
                    'author':author,
                    'other':other
                }
                videoJsons.push(titleJson);
            }else if (className === 'article-info pictures') {
                var titleEle = $(element).find('.title').children()[0];
                var title = $(titleEle).text().trim();
                var imgEles = $(element).find('.picture-list').children();
                var imgs = [];
                imgEles.map((idx,pEle)=> {
                    var pClassName = $(pEle).attr('class');
                    if (pClassName === 'art-img') {
                        var imgEle = $(pEle).find('img');
                        var imgSrc = $(imgEle).attr('src');
                        imgs.push(imgSrc);
                    }
                });
                var authorEle = $(element).find('.author').children()[0];
                var author = $(authorEle).text().trim();
                var otherEle = $(element).find('.author').children()[1];
                var other = $(otherEle).text().trim();
                var titleJson = {
                    'type':className,
                    'images':imgs,
                    'title':title,
                    'author':author,
                    'other':other
                }
                videoJsons.push(titleJson);
            }
        });
        var videoJson = createResult(url,videoJsons);
        cb(null,videoJson);
    });
}

function createResult(url,videos) {
    var urlParse = URL.parse(url);
    var index = 0;
    if (urlParse.query) {
        index = parseInt(urlParse.query.substr(4,1));
    }
    index = index > 0 ?index : 0;
    var titleJson = titleJsons[index];
    var videoJson = {
        'title':titleJson['title'],
        'videos':videos
    }
    return videoJson;
}

startFetch();