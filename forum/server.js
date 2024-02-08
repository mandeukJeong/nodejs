require('dotenv').config();
const { PORT, MONGODB_URI } = process.env;

const express = require('express')
const app = express()

app.use(express.static(__dirname + '/public'))
app.set('view engine', 'ejs')

const { MongoClient } = require('mongodb')

let db;
const url = MONGODB_URI
new MongoClient(url).connect().then((client)=>{
  console.log('DB연결성공')
  db = client.db('forum')
  app.listen(PORT, () => {
    console.log('http://localhost:8080 에서 서버 실행중')
})
}).catch((err)=>{
  console.log(err)
})

app.get('/', (요청, 응답) => {
    응답.sendFile(__dirname + '/index.html')
})

app.get('/list', async (요청, 응답) => {
    let result = await db.collection('post').find().toArray()
    console.log(result[0].title) 
    응답.render('list.ejs', {posts: result})
})

app.get('/time', async (요청, 응답) => {
    응답.render('time.ejs', {time: new Date()})
})