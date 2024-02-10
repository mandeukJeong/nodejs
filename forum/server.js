require('dotenv').config();
const { PORT, MONGODB_URI } = process.env;

const express = require('express')
const app = express()

app.use(express.static(__dirname + '/public'))
app.set('view engine', 'ejs')

const { MongoClient, ObjectId } = require('mongodb')

app.use(express.json())
app.use(express.urlencoded({extended: true}))

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

app.get('/write', async (요청, 응답) => {
  응답.render('write.ejs')
})

app.post('/add', async (요청, 응답) => {
  console.log(요청.body)
  try {
    if (요청.body.title == "") {
      응답.send('제목 입력 안했는데')
    } else {
      await db.collection('post').insertOne({title: 요청.body.title, content: 요청.body.content})
      응답.redirect('/list')
    }
  } catch(e) {
    console.log(e)
    응답.status(500).send('서버에러남')
  }
})

app.get('/detail/:id', async (요청, 응답) => {
  let result = await db.collection('post').findOne({_id: new ObjectId(요청.params.id)})
  console.log(result)
  응답.render('detail.ejs', {data: result})
})