// src/routes/dashboard.js
const router = require('express').Router();
const pool   = require('../db/pool');
const { auth } = require('../middleware/auth');

router.get('/summary', auth, async (req, res) => {
  const isTrainer = req.user.role === 'trainer';
  const tid     = isTrainer ? req.user.trainer_id : null;
  const params  = tid ? [tid] : [];
  const tFilter = tid ? 'AND trainer_id = $1' : '';   // for WHERE … AND trainer_id
  const pFilter = tid ? 'AND p.trainer_id = $1' : ''; // for payments alias p
  const tWhere  = tid ? 'WHERE trainer_id = $1' : ''; // standalone WHERE

  try {
    const [
      clientStats,
      revStats,
      todaySale,
      expiring,
      dues,
      recentPay,
      monthly,
      topTrainers,
      attendance,
      birthdays,
      anniversaries,
      pendingRenewals,
      activePT,
    ] = await Promise.all([

      /* ── 1. Client counts incl. new-this-month ────────────────────── */
      pool.query(`
        SELECT
          COUNT(*)                                                         AS total,
          COUNT(*) FILTER (WHERE status = 'active')                       AS active,
          COUNT(*) FILTER (WHERE status = 'expired')                      AS expired,
          COUNT(*) FILTER (WHERE status = 'frozen')                       AS frozen,
          COUNT(*) FILTER (WHERE
            created_at >= DATE_TRUNC('month', NOW())
          )                                                                AS new_this_month
        FROM clients
        ${tWhere}`, params),

      /* ── 2. Revenue totals (month / year / all-time) ─────────────── */
      pool.query(`
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE date >= DATE_TRUNC('month', NOW())), 0) AS month,
          COALESCE(SUM(amount) FILTER (WHERE date >= DATE_TRUNC('year',  NOW())), 0) AS year,
          COALESCE(SUM(amount), 0)                                                   AS total
        FROM payments
        ${tWhere}`, params),

      /* ── 3. Today's sale ─────────────────────────────────────────── */
      pool.query(`
        SELECT COALESCE(SUM(amount), 0) AS today
        FROM payments
        WHERE date = CURRENT_DATE
          ${tFilter}`, params),

      /* ── 4. Expiring subscriptions (next 7 days) ─────────────────── */
      pool.query(`
        SELECT COUNT(*) AS count
        FROM clients
        WHERE status = 'active'
          AND pt_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
          ${tFilter}`, params),

      /* ── 5. Outstanding dues ─────────────────────────────────────── */
      pool.query(`
        SELECT COALESCE(SUM(balance_amount), 0) AS total_dues
        FROM clients
        WHERE balance_amount > 0
          ${tFilter}`, params),

      /* ── 6. Recent payments (last 8) ─────────────────────────────── */
      pool.query(`
        SELECT p.id, p.amount, p.method, p.date, p.receipt_no,
               c.name AS client_name, t.name AS trainer_name
        FROM   payments p
        LEFT JOIN clients  c ON c.id = p.client_id
        LEFT JOIN trainers t ON t.id = p.trainer_id
        WHERE  1=1
          ${pFilter}
        ORDER  BY p.created_at DESC
        LIMIT  8`, params),

      /* ── 7. Monthly chart (last 6 months) ───────────────────────── */
      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', date::date), 'Mon YY') AS month,
          COALESCE(SUM(amount), 0)                            AS revenue,
          COUNT(*)                                            AS count
        FROM payments
        WHERE date >= NOW() - INTERVAL '6 months'
          ${tFilter}
        GROUP  BY DATE_TRUNC('month', date::date)
        ORDER  BY DATE_TRUNC('month', date::date)`, params),

      /* ── 8. Top 5 trainers by this-month revenue (admin only) ────── */
      !tid ? pool.query(`
        SELECT t.id, t.name, t.specialization,
          COUNT(c.id)  FILTER (WHERE c.status = 'active')                   AS active_clients,
          COALESCE(SUM(p.amount) FILTER (
            WHERE p.date >= DATE_TRUNC('month', NOW())
          ), 0)                                                               AS month_revenue
        FROM   trainers t
        LEFT JOIN clients  c ON c.trainer_id = t.id
        LEFT JOIN payments p ON p.trainer_id = t.id
        WHERE  t.status = 'active'
        GROUP  BY t.id, t.name, t.specialization
        ORDER  BY month_revenue DESC
        LIMIT  5`)
      : Promise.resolve({ rows: [] }),

      /* ── 9. Attendance today ─────────────────────────────────────── */
      pool.query(`
        SELECT COUNT(*) AS present
        FROM   attendance
        WHERE  date   = CURRENT_DATE
          AND  status = 'present'
          AND  type   = 'client'
          ${tFilter}`, params),

      /* ── 10. Birthdays today ─────────────────────────────────────── */
      pool.query(`
        SELECT COUNT(*) AS count
        FROM   clients
        WHERE  status = 'active'
          AND  dob IS NOT NULL
          AND  EXTRACT(MONTH FROM dob::date) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND  EXTRACT(DAY   FROM dob::date) = EXTRACT(DAY   FROM CURRENT_DATE)
          ${tFilter}`, params),

      /* ── 11. Anniversaries today (join_date anniversary) ─────────── */
      pool.query(`
        SELECT COUNT(*) AS count
        FROM   clients
        WHERE  status     = 'active'
          AND  join_date  IS NOT NULL
          AND  EXTRACT(MONTH FROM join_date::date) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND  EXTRACT(DAY   FROM join_date::date) = EXTRACT(DAY   FROM CURRENT_DATE)
          AND  EXTRACT(YEAR  FROM join_date::date) < EXTRACT(YEAR  FROM CURRENT_DATE)
          ${tFilter}`, params),

      /* ── 12. Pending renewals (expired within last 30 days) ──────── */
      pool.query(`
        SELECT COUNT(*) AS count
        FROM   clients
        WHERE  status    = 'expired'
          AND  pt_end_date >= CURRENT_DATE - INTERVAL '30 days'
          ${tFilter}`, params),

      /* ── 13. Active PT subscriptions ─────────────────────────────── */
      pool.query(`
        SELECT COUNT(*) AS count
        FROM   clients
        WHERE  status = 'active'
          AND  has_pt = true
          ${tFilter}`, params),
    ]);

    /* ── Build response ─────────────────────────────────────────────── */
    const cli = clientStats.rows[0];
    const rev = revStats.rows[0];

    res.json({
      /* Client counts */
      clients: {
        total:          parseInt(cli.total),
        active:         parseInt(cli.active),
        expired:        parseInt(cli.expired),
        frozen:         parseInt(cli.frozen),
        new_this_month: parseInt(cli.new_this_month),
      },

      /* Revenue */
      revenue: {
        today: parseFloat(todaySale.rows[0].today),
        month: parseFloat(rev.month),
        year:  parseFloat(rev.year),
        total: parseFloat(rev.total),
      },

      /* Operational counters */
      expiring_soon:       parseInt(expiring.rows[0].count),
      total_dues:          parseFloat(dues.rows[0].total_dues),
      attendance_today:    parseInt(attendance.rows[0].present),
      birthdays_today:     parseInt(birthdays.rows[0].count),
      anniversaries_today: parseInt(anniversaries.rows[0].count),
      pending_renewals:    parseInt(pendingRenewals.rows[0].count),
      active_pt_clients:   parseInt(activePT.rows[0].count),

      /* Lists */
      recent_payments: recentPay.rows,
      monthly_chart:   monthly.rows,
      top_trainers:    topTrainers.rows,
    });

  } catch (err) {
    console.error('Dashboard summary error:', err.message);
    res.status(500).json({ error: 'Dashboard query failed: ' + err.message });
  }
});

module.exports = router;
