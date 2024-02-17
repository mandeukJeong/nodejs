const router = require('express').Router()

router.get('/sub/sports', (요청, 응답) => {
   응답.send('스포츠 게시판')
})

router.get('/sub/game', (요청, 응답) => {
   응답.send('게임 게시판')
}) 

module.exports = router