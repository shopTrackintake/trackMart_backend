import pool from "../config/db.js";

/* ================= USER CREATE ISSUE ================= */

export const createSupportTicket = async (req,res)=>{

try{

const { subject,message } = req.body;

const ticket = await pool.query(
`
INSERT INTO support_tickets (user_id,subject,message)
VALUES ($1,$2,$3)
RETURNING *
`,
[req.user.id,subject,message]
);

/* ================= NOTIFY ADMIN ================= */

const admins = await pool.query(
"SELECT id FROM users WHERE role='admin'"
);

for(const admin of admins.rows){

await pool.query(
`
INSERT INTO notifications(user_id,title,message,type)
VALUES ($1,$2,$3,$4)
`,
[
admin.id,
"New User Issue",
"A user submitted a support request",
"support"
]
);

}

res.json(ticket.rows[0]);

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};



/* ================= USER GET HIS ISSUES ================= */

export const getUserTickets = async (req,res)=>{

try{

const tickets = await pool.query(
`
SELECT *
FROM support_tickets
WHERE user_id=$1
ORDER BY created_at DESC
`,
[req.user.id]
);

res.json(tickets.rows);

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};



/* ================= ADMIN GET ALL ISSUES ================= */

export const getAdminTickets = async (req,res)=>{

try{

const tickets = await pool.query(
`
SELECT
t.*,
u.name,
u.email
FROM support_tickets t
JOIN users u ON t.user_id = u.id
ORDER BY t.created_at DESC
`
);

res.json(tickets.rows);

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};



/* ================= ADMIN REPLY ================= */

export const replyTicket = async (req,res)=>{

try{

const { id } = req.params;
const { reply } = req.body;

/* UPDATE TICKET */

await pool.query(
`
UPDATE support_tickets
SET admin_reply=$1,
status='closed',
replied_at=NOW()
WHERE id=$2
`,
[reply,id]
);


/* GET USER ID */

const ticket = await pool.query(
`
SELECT user_id
FROM support_tickets
WHERE id=$1
`,
[id]
);

const userId = ticket.rows[0].user_id;


/* NOTIFY USER */

await pool.query(
`
INSERT INTO notifications(user_id,title,message,type)
VALUES ($1,$2,$3,$4)
`,
[
userId,
"Support Reply",
"Admin responded to your issue",
"support"
]
);

res.json({message:"Reply sent"});

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};