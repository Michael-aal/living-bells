import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app = express()
const PORT = Number(process.env.PORT || 5000)

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'living-bells-backend',
  })
})

app.get('/api/dashboard', (_req, res) => {
  res.json({
    attendance: [],
    expenses: [],
    activities: [],
  })
})

app.get('/api/attendance', (_req, res) => {
  res.json([])
})

app.post('/api/attendance', (req, res) => {
  res.status(201).json({
    message: 'Attendance received',
    data: req.body,
  })
})

app.get('/api/expenses', (_req, res) => {
  res.json([])
})

app.post('/api/expenses', (req, res) => {
  res.status(201).json({
    message: 'Expense received',
    data: req.body,
  })
})

app.listen(PORT, () => {
  console.log(`Living Bells backend running on http://localhost:${PORT}`)
})
