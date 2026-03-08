import pool from "../config/db.js";

export const getNotifications = async(req,res)=>{

try{

const notifications = await pool.query(
`
SELECT *
FROM notifications
WHERE user_id=$1
ORDER BY created_at DESC
`,
[req.user.id]
);

res.json(notifications.rows);

}catch(err){

console.log(err);
res.status(500).json({message:err.message});

}

};
export const markNotificationRead = async (req, res) => {
  try {

    const { id } = req.params;

    await pool.query(
      `
      UPDATE notifications
      SET is_read=true
      WHERE id=$1
      `,
      [id]
    );

    res.json({ message: "Notification marked as read" });

  } catch (err) {

    console.log(err);
    res.status(500).json({ message: err.message });

  }
};