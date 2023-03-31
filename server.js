import { createServer } from 'http';
import path from 'path';
import { readdirSync, readFile, createReadStream, access, unlink, writeFile } from 'fs';
import { Transform } from 'stream';

const host = 'localhost';
const port = 8000;
const _dir = 'files';
const user = {
    id: 123,
    username: 'qqq',
    password: 'qqq'
};



function getCookie(request, cookieName = ['userId', 'authorized']) {
    const cookies = request.headers.cookie; // Получаем заголовок cookie из запроса
    let cookieValue = {};

    if (cookies) {
        cookieName.forEach((val, index) => {
            cookieValue[`${val}`] = cookies
                .split(';')
                .find(cookie => cookie.trim().startsWith(`${val}=`))
                .split('=')[1];
        });
    }
    return cookieValue
}

function isAuthorized({ userId, authorized }, res) {

    if (Number(userId) === user.id && authorized === 'true') {
        return true
    } else {
        res.writeHead(401, {
            'Content-Type': 'text/html; charset=utf-8;'
        });
        res.end(`Пользователь не авторизован! Перейдите на <a href='http://${host}:${port}/'> страницу авторизации</a>`);
        return false
    }
}

function createFile(fileName, _dir, content, res) {
    access(path.join(_dir, fileName), (err) => {
        if (err) {
            if (err.code === 'ENOENT') { // файл не существует
                writeFile(path.join(_dir, fileName), content, (err) => {
                    if (err) throw err;
                    res.writeHead(200);
                    res.end(`Файл ${fileName} создан и записан`)
                });
            } else { // другая ошибка
                res.writeHead(500);
                res.end(`Произошла ошибка: ${err}`);
            }
        } else { // файл существует
            res.writeHead(409);
            res.end(`Файл ${fileName} уже существует`);
        }
    });

}

function deleteFile(fileName, _dir, res) {
    access(path.join(_dir, fileName), (err) => {
        if (err) {
            if (err.code === 'ENOENT') { // файл не существует
                res.writeHead(404)
                res.end(`Файл ${fileName} не найден`)
            } else { // другая ошибка
                res.writeHead(500);
                res.end(`Произошла ошибка: ${err}`);
            }
        } else { // файл существует
            unlink(path.join(_dir, fileName), (err) => {
                if (err) {
                    res.writeHead(500);
                    res.end(`Произошла ошибка: ${err} `);
                }
                res.writeHead(200);
                res.end(`Файл ${fileName} удален`)
            });

        }
    });

}

function requestListener(req, res) {
    res.setHeader(
        'Content-Type',
        'text/html; charset=utf-8;'
    )

    if (req.method === 'GET') {
        if (req.url === '/get') {
            let listFiles = '';
            try {
                const files = readdirSync(path.resolve(_dir), 'utf8');
                res.writeHead(200);
                res.write(files.join());
                res.end();
            } catch (err) {
                res.writeHead(500);
                res.end('Internal server error');
            }
        } else if (req.url === '/redirect') {
            //301 - "Перемещён на постоянной основе".
            res.writeHead(301, { 'Location': '/redirected' });
            res.end('redirecting');
        } else if (req.url === '/redirected') {
            res.end(`Ресурс теперь постоянно доступен по адресу http://${host}:${port}/redirected`);
        } else if (req.url === '/') {
            readFile('./index.html', null, function (err, html) {
                res.writeHead(200);
                res.end(html);
            });
        } else if (req.url === '/main') {
            if (isAuthorized(getCookie(req), res)) {
                readFile('./other.html', null, function (err, html) {
                    res.writeHead(200);
                    res.end(html);
                })
            }
        }
        else {
            res.writeHead(405);
            res.end('HTTP method not allowed');
        }
    } else if (req.method === 'POST') {
        if (req.url === '/post') {
            if (isAuthorized(getCookie(req), res)) {
                let data = '';
                req.on('data', chunk => {
                    data += chunk;
                })
                req.on('end', () => {
                    if (JSON.parse(data).filename === '') {
                        res.writeHead(400);
                        res.end('Не переданы необходимые данные - имя файла')
                    } else {
                        createFile(
                            JSON.parse(data).filename,
                            './files',
                            JSON.parse(data).content,
                            res
                        )
                    }
                })
            }
        } else if (req.url === '/auth') {
            let data = '';
            req.on('data', chunk => {
                data += chunk;
            })
            req.on('end', () => {
                if (user.username === JSON.parse(data).login && user.password === JSON.parse(data).password) {
                    const twoDays = 2 * 24 * 60 * 60 * 1000;
                    const expires = new Date(Date.now() + twoDays).toUTCString();
                    res.setHeader('Set-Cookie', [
                        `userId=${user.id}; Expires=${expires}; max_age=${twoDays}; path=/; domain=${host}`,
                        `authorized=true; Expires=${expires}; max_age=${twoDays}; path=/; domain=${host}`]);
                    res.end();
                } else {
                    res.writeHead(400);
                    res.end('Неверный логин или пароль');
                }
            })
        }
    } else if (req.method === 'DELETE' && req.url === '/delete') {
        if (isAuthorized(getCookie(req), res)) {
            let data = '';
            req.on('data', chunk => {
                data += chunk;
            })
            req.on('end', () => {
                if (JSON.parse(data).filename === '') {
                    res.writeHead(400);
                    res.end('Не переданы необходимые данные - имя файла')
                } else {
                    deleteFile(
                        JSON.parse(data).filename,
                        './files',
                        res
                    )
                }
            })
        }
    } else {
        res.writeHead(405);
        res.end('HTTP method not allowed');
    }

};

const server = createServer(requestListener);

server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});