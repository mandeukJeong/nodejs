require('dotenv').config();
const { PORT, MONGODB_URI, S3_KEY, S3_SECRET } = process.env;
const express = require('express')
const app = express()
const { MongoClient, ObjectId } = require('mongodb')
const methodOverride = require('method-override')
const bcrypt = require('bcrypt')

const { createServer } = require('http')
const { Server } = require('socket.io')
const server = createServer(app)
const io = new Server(server) 

app.use(methodOverride('_method'))
app.use(express.static(__dirname + '/public'))
app.set('view engine', 'ejs')
app.use(express.json())
app.use(express.urlencoded({extended: true}))

const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')
const MongoStore = require('connect-mongo')

app.use(passport.initialize())
app.use(session({
  secret: '암호화에 쓸 비번',
  resave : false,
  saveUninitialized : false,
  cookie: { maxAge: 60 * 60 * 1000},
  store: MongoStore.create({
    mongoUrl: MONGODB_URI,
    dbName: 'forum'
  })
}))

app.use(passport.session()) 

const { S3Client } = require('@aws-sdk/client-s3')
const multer = require('multer')
const multerS3 = require('multer-s3')
const s3 = new S3Client({
  region : 'ap-northeast-2',
  credentials : {
      accessKeyId : S3_KEY,
      secretAccessKey : S3_SECRET
  }
})

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'minseoforum',
    key: function (요청, file, cb) {
      cb(null, Date.now().toString()) //업로드시 파일명 변경가능
    }
  })
})

let connectDB = require('./database.js')

let db;
let changeStream;
connectDB.then((client)=>{
  console.log('DB연결성공')
  db = client.db('forum')
  let condition = [
    { $match: { operationType: 'insert' } }
  ]

  changeStream = db.collection('post').watch(condition)
  server.listen(PORT, () => {
    console.log('http://localhost:8080 에서 서버 실행중')
})
}).catch((err)=>{
  console.log(err)
})

function checkLogin(요청, 응답, next) {
  if (!요청.user) {
    응답.send('로그인하세요')
  }
  next()
}

function printTime(request, response, next) {
  console.log(new Date())
  next()
}

function checkEmpty(request, response, next) {
  if (request.body.username == "" || request.body.password == "") {
    response.send('그러지마세요')
  } else {
    next()
  }
}

app.use('/list', printTime)

app.get('/', (요청, 응답) => {
    응답.sendFile(__dirname + '/index.html')
})

app.get('/list', async (요청, 응답) => {
  let result = await db.collection('post').find().toArray()
  응답.render('list.ejs', {posts: result, user: 요청.user})
})

app.get('/time', checkLogin, async (요청, 응답) => {
    응답.render('time.ejs', {time: new Date()})
})

app.get('/write', async (요청, 응답) => {
  응답.render('write.ejs')
})

app.post('/add', upload.single('img1'), async (요청, 응답) => {
  try {
    if (요청.body.title == "") {
      응답.send('제목 입력 안했는데')
    } else {
      await db.collection('post').insertOne({title: 요청.body.title, content: 요청.body.content, img: 요청.file ? 요청.file.location : "", user:요청.user._id, username: 요청.user.username })
      응답.redirect('/list')
    }
  } catch(e) {
    console.log(e)
    응답.status(500).send('서버에러남')
  }
})

app.get('/detail/:id', async (요청, 응답) => {
  try {
    let comment = await db.collection('comment').find({parentId: new ObjectId(요청.params.id)}).toArray()
    let result = await db.collection('post').findOne({_id: new ObjectId(요청.params.id)})
    if (result == null) {
      응답.status(404).send('게시물이 존재하지 않음')
    } else {
      응답.render('detail.ejs', {data: result, comment: comment})
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
      await db.collection('post').updateOne({_id: new ObjectId(요청.params.id), user: new ObjectId(요청.user._id)}, {$set: {title: 요청.body.title, content: 요청.body.content}})
      응답.redirect('/list')
    }
  } catch(e) {
    console.log(e)
  }
})

app.delete('/delete', async (요청, 응답) => {
  await db.collection('post').deleteOne({
    _id: new ObjectId(요청.query.docid),
    user: new ObjectId(요청.user._id)
  })
  응답.send('삭제완료')
})

app.get('/list/:id', async (요청, 응답) => {
  let result = await db.collection('post').find().skip((요청.params.id - 1) * 5).limit(5).toArray()
  응답.render('list.ejs', {posts: result})
})

app.get('/list/next/:id', async (요청, 응답) => {
  let result = await db.collection('post').find({ _id: { $gt: new ObjectId(요청.params.id)}}).limit(5).toArray()
  응답.render('list.ejs', {posts: result})
})

passport.use(new LocalStrategy(async (입력한아이디, 입력한비번, cb) => {
  let result = await db.collection('user').findOne({ username : 입력한아이디})
  if (!result) {
    return cb(null, false, { message: '아이디 DB에 없음' })
  }

  if (await bcrypt.compare(입력한비번, result.password)) {
    return cb(null, result)
  } else {
    return cb(null, false, { message: '비번불일치' });
  }
}))

passport.serializeUser((user, done) => {
  process.nextTick(() => {
    done(null, { id: user._id, username: user.username })
  })
})

passport.deserializeUser(async (user, done) => {
  let result = await db.collection('user').findOne({_id: new ObjectId(user.id)})
  delete result.password
  process.nextTick(() => {
    done(null, result)
  })
})

app.get('/login', async (요청, 응답) => {
  console.log(요청.user)
  응답.render('login.ejs')
}) 

app.post('/login', checkEmpty,  async (요청, 응답, next) => {
  passport.authenticate('local', (error, user, info) => {
    if (error) return 응답.status(500).json(error)
    if (!user) return 응답.status(401).json(info.message)
    요청.logIn(user, (err) => {
      if (err) return next(err)
      응답.redirect('/mypage')
    })
  })(요청, 응답, next)
}) 

app.get('/mypage', async (요청, 응답) => {
  if (!요청.user) return 응답.status(401).redirect('/')
  else return 응답.render('mypage.ejs', {user: 요청.user})
})

app.get('/register', (요청, 응답) => {
  응답.render('register.ejs')
})

app.post('/register',checkEmpty, async (요청, 응답) => {
  try {
    const isDup = await db.collection('user').findOne({username: 요청.body.username})
    if (isDup) {
      응답.send("중복된 아이디가 존재합니다.")
    } else if (요청.body.password != 요청.body.passwordConfirm) {
      응답.send("두 비밀번호가 일치하지 않습니다.")
    } else {
      let hash = await bcrypt.hash(요청.body.password, 10)
  
      await db.collection('user').insertOne({username: 요청.body.username, password: hash})
      응답.redirect('/')
    }
  } catch(e) {
    console.log(e)
  }
})

app.use('/shop', require('./routes/shop.js'))
app.use('/board', [checkLogin, require('./routes/board.js')])

app.get('/search', async (요청, 응답) => {
  let searchCondition = [
    {
      $search: {
        index: 'title_index',
        text: { query: 요청.query.val, path: 'title'}
      }
    }
  ]

  let result = await db.collection('post').aggregate(searchCondition).toArray()
  응답.render('search.ejs', {posts: result})
})

app.post('/comment', async (요청, 응답) => {
  await db.collection('comment').insertOne({
    content: 요청.body.content,
    writeId: new ObjectId(요청.user.id),
    writer: 요청.user.username,
    parentId: new ObjectId(요청.body.parentId)
  })
  응답.redirect('back') 
})

app.get('/chat/request', async (요청, 응답) => {
  await db.collection('chatroom').insertOne({
    member: [요청.user._id, new ObjectId(요청.query.writerId)],
    date: new Date()
  })
  응답.redirect('/chat/list')
})

app.get('/chat/list', async (요청, 응답) => {
  let result = await db.collection('chatroom').find({
    member: 요청.user._id
  }).toArray()
  응답.render('chatList.ejs', {result: result})
})

app.get('/chat/detail/:id', async (요청, 응답) => {
  let result = await db.collection('chatroom').findOne({
    _id: new ObjectId(요청.params.id)
  })
  응답.render('chatDetail.ejs', {result: result})
})

io.on('connection', (socket) => {
  socket.on('ask-join', (data) => {
    socket.join(data)
  })

  socket.on('message', (data) => {
    io.to(data.room).emit('broadcast', data.msg)
  })
})

app.get('/stream/list', (요청, 응답) => {
  응답.writeHead(200, {
    "Connection": "keep-alive",
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
  });

  changeStream.on('change', (result) => {
    응답.write('event: msg\n')
    응답.write(`data: ${JSON.stringify(result.fullDocument)}\n\n`)
  })
})