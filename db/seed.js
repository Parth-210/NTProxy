require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { initDb, getDb, DB_PATH } = require('./setup');

async function seed() {
  // Delete old database so autoincrement IDs start fresh
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('🗑  Removed existing database\n');
  }

  await initDb();
  const db = getDb();
  const salt = bcrypt.genSaltSync(10);

  console.log('🌱 Seeding NTProxy database...\n');


  // Clear existing data
  db.run('DELETE FROM attendance');
  db.run('DELETE FROM sessions');
  db.run('DELETE FROM enrollments');
  db.run('DELETE FROM subjects');
  db.run('DELETE FROM students');
  db.run('DELETE FROM professors');

  // Professors
  const professors = [
    { id: 'PROF001', name: 'Dr. Amit Sharma', password: 'password123' },
    { id: 'PROF002', name: 'Dr. Priya Patel', password: 'password123' },
    { id: 'PROF003', name: 'Dr. Rajesh Kumar', password: 'password123' },
  ];
  professors.forEach(p => {
    db.run('INSERT INTO professors (id, name, password_hash) VALUES (?, ?, ?)', [p.id, p.name, bcrypt.hashSync(p.password, salt)]);
    console.log(`  👨‍🏫 Professor: ${p.id} — ${p.name}`);
  });

  // Students
  const students = [
    { id: 'STU001', name: 'Arjun Mehta',    branch: 'CSE', semester: 5 },
    { id: 'STU002', name: 'Sneha Gupta',    branch: 'CSE', semester: 5 },
    { id: 'STU003', name: 'Rohan Singh',    branch: 'IT',  semester: 3 },
    { id: 'STU004', name: 'Ananya Desai',   branch: 'CSE', semester: 5 },
    { id: 'STU005', name: 'Vikram Joshi',   branch: 'ECE', semester: 7 },
    { id: 'STU006', name: 'Kavya Nair',     branch: 'IT',  semester: 3 },
    { id: 'STU007', name: 'Aditya Verma',   branch: 'CSE', semester: 5 },
    { id: 'STU008', name: 'Ishita Sharma',  branch: 'ECE', semester: 7 },
    { id: 'STU009', name: 'Manav Patel',    branch: 'IT',  semester: 3 },
    { id: 'STU010', name: 'Divya Reddy',    branch: 'CSE', semester: 5 },
  ];
  students.forEach(s => {
    db.run('INSERT INTO students (id, name, password_hash, branch, semester) VALUES (?, ?, ?, ?, ?)',
      [s.id, s.name, bcrypt.hashSync('password123', salt), s.branch, s.semester]);
    console.log(`  👨‍🎓 Student: ${s.id} — ${s.name}`);
  });

  // Subjects
  const subjectRows = [
    { name: 'Data Structures',    profId: 'PROF001' },
    { name: 'Database Systems',   profId: 'PROF001' },
    { name: 'Computer Networks',  profId: 'PROF002' },
    { name: 'Operating Systems',  profId: 'PROF002' },
    { name: 'Digital Electronics', profId: 'PROF003' },
  ];
  const subjectIds = {};
  for (const s of subjectRows) {
    const r = db.run('INSERT INTO subjects (name, professor_id) VALUES (?, ?)', [s.name, s.profId]);
    subjectIds[s.name] = r.lastInsertRowid;
    console.log(`  📚 Subject: ${s.name} (ID: ${r.lastInsertRowid})`);
  }

  // Enrollments
  const enrollments = [
    { name: 'Data Structures',    students: ['STU001','STU002','STU004','STU007','STU010'] },
    { name: 'Database Systems',   students: ['STU001','STU002','STU004','STU007','STU010'] },
    { name: 'Computer Networks',  students: ['STU001','STU002','STU003','STU006','STU009'] },
    { name: 'Operating Systems',  students: ['STU003','STU006','STU009'] },
    { name: 'Digital Electronics', students: ['STU005','STU008'] },
  ];
  for (const e of enrollments) {
    const subId = subjectIds[e.name];
    if (!subId) { console.warn(`  ⚠ No ID found for ${e.name}`); continue; }
    for (const sid of e.students) {
      db.run('INSERT OR IGNORE INTO enrollments (student_id, subject_id) VALUES (?, ?)', [sid, subId]);
    }
    console.log(`  📋 Enrolled ${e.students.length} students in ${e.name} (subject_id=${subId})`);
  }

  console.log('\n✅ Database seeded successfully!');
  console.log('\n📝 Login Credentials (password: password123):');
  console.log('   Professors: PROF001, PROF002, PROF003');
  console.log('   Students:   STU001 through STU010\n');
  process.exit(0);
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
