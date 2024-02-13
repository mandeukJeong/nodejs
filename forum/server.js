require('dotenv').config();
const { PORT, MONGODB_URI } = process.env;
const express = require('express')
const app = express()
const { MongoClient, ObjectId } = require('mongodb')
const methodOverride = require('method-override')

app.use(methodOverride('_method'))
app.use(express.static(__dirname + '/public'))
app.set('view engine', 'ejs')
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
  try {
    let result = await db.collection('post').findOne({_id: new ObjectId(요청.params.id)})
    if (result == null) {
      응답.status(404).send('게시물이 존재하지 않음')
    } else {
      응답.render('detail.ejs', {data: result})
    }
  } catch (e) {
    console.log(e)
    응답.status(400).send('이상한 거 넣지마세요')
  }  
})

app.get('/edit/:id', async (요청, 응답) => {
  try {
    let result = await db.collection('post').findOne({_id: new ObjectId(요청.params.id)})
    if (result == null) {
      응답.status(404).send('게시물이 존재하지 않음')
    } else {
      응답.render('edit.ejs', {result: result})
    }
  } catch(e) {
    console.log(e)
  }
})

app.put('/edit/:id', async (요청, 응답) => {
  try {
    if (요청.body.title == "" || 요청.body.content == "") {
      응답.send("빈칸이 있습니다.")
    } else {
      await db.collection('post').updateOne({_id: new ObjectId(요청.params.id)}, {$set: {title: 요청.body.title, content: 요청.body.content}})
      응답.redirect('/list')
    }
  } catch(e) {
    console.log(e)
  }
})

app.delete('/delete', async (요청, 응답) => {
  await db.collection('post').deleteOne({_id: new ObjectId(요청.query.docid)})
  응답.send('삭제완료')
})