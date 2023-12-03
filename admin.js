const validator = require('validator');
const readline = require("readline");
const fs = require('fs');
const conn = require('./configdb');
// const md5 = require('md5');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const moment = require('moment');


// Konfigurasi transporter langsung di dalam admin.js 
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'nfsyalza@gmail.com',
    pass: 'atmp lfce lugq yjew', // Gunakan kata sandi aplikasi di sini
  },
});

// Fungsi untuk memverifikasi email admin
  async function verifyAdminEmail(email) {
    try {
      // Log untuk melihat nilai email yang dikirim ke fungsi
      console.log('Email to Verify:', email);
  
      // Kueri SQL untuk memeriksa apakah admin dengan email yang diberikan ada
      const query = 'SELECT * FROM admin WHERE email = ?';
  
      // Jalankan kueri dengan email yang diberikan
      const [result] = await runQuery(query, [email]);
  
      // Logging untuk melihat hasil query
      console.log('Query Result:', result);
  
      // Periksa apakah ada hasil, menunjukkan adanya admin dengan email yang diberikan
      return result && result.length > 0;
    } catch (error) {
      console.error('Error verifikasi email admin:', error);
      throw error;
    }
  }


// Fungsi untuk memeriksa apakah token reset valid
async function isValidResetToken(token) {
  try {
    // Kueri SQL untuk memeriksa apakah token ada dan belum kedaluwarsa
    const query = 'SELECT * FROM admin_reset_tokens WHERE token = ?';

    // Jalankan kueri dengan token yang diberikan
    const [result] = await runQuery(query, [token]);

    // Periksa apakah ada hasil
    if (!result) {
      return false; // Token tidak ditemukan di database
    }

    // Ambil waktu ekspirasi token dari hasil query
    const tokenExpirationTime = moment(result?.expiration_time);

    // Tambahkan pesan log untuk menampilkan waktu kedaluwarsa token dan waktu saat ini
    console.log('Token Expiration Time (Saved):', tokenExpirationTime.format());
    console.log('Current Time (Validation):', moment().format());
    console.log('Is Token Valid (Validation):', tokenExpirationTime.isAfter(moment()));

    // Kembalikan true jika token ditemukan dan belum kedaluwarsa
    return tokenExpirationTime.isAfter(moment());
  } catch (error) {
    console.error('Error memeriksa kevalidan token reset:', error);
    throw error;
  }
}

// Fungsi untuk menghasilkan token reset yang unik
async function generateResetToken() {
  // Menghasilkan string hexa acak sepanjang 32 karakter sebagai token
  const token = crypto.randomBytes(20).toString('hex');
  return token;
}

// Fungsi untuk menyimpan token reset ke dalam database
async function saveResetToken(email, token) {
  try {
    // Contoh penggunaan database MySQL
    const query = 'INSERT INTO admin_reset_tokens (email, token, expiration_time) VALUES (?, ?, NOW() + INTERVAL 24 HOUR)';

    // Menyimpan token ke database dengan waktu kedaluwarsa 24 jam dari sekarang
    await runQuery(query, [email, token]);

    const expirationTime = moment().add(24, 'hours');
    console.log('Token reset disimpan dengan sukses untuk email:', email);
    console.log('Token Expiration Time (Saved):', expirationTime.format());
  } catch (error) {
    console.error('Error saat menyimpan token reset untuk email', email, ':', error);
    throw error;
  }
}

// Fungsi untuk mengirim email reset password
async function sendPasswordResetEmail(email) {
  try {
    const resetToken = await generateResetToken();
    await saveResetToken(email, resetToken);

    const resetLink = `http://localhost:3000/reset-password/${resetToken}`;
    const mailOptions = {
      from: 'nfsyalza@gmail.com',
      to: email,
      subject: 'Reset Password',
      text: `Untuk mereset password Anda, klik tautan berikut: ${resetLink}`,
      html: `<p>Untuk mereset password Anda, klik tautan berikut: <a href="${resetLink}">${resetLink}</a></p>`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email terkirim: ' + info.response);

    return info;
  } catch (error) {
    console.error(error.message);
    throw new Error('Error mengirim email reset password.');
  }
}

// Fungsi untuk memeriksa validitas token reset
// Fungsi untuk memeriksa validitas token reset dan mengupdate password admin
async function resetPassword(token, newPassword) {
  try {
 
    // Memeriksa validitas token
    const querySelect = 'SELECT * FROM admin_reset_tokens WHERE token = ?';
    console.log('Mencari token dengan query:', querySelect);
    const [resultSelect] = await runQuery(querySelect, [token]);
    console.log('Hasil pencarian token:', resultSelect);
    // console.log('Hasil query:', {
    //   id: resultSelect.id,
    //   email: resultSelect.email,
    //   token: resultSelect.token,
    //   expiration_time: resultSelect.expiration_time.toISOString(),
    // });

    if (!resultSelect || Object.keys(resultSelect).length === 0) {
      console.log('Token tidak ditemukan atau tidak valid.');
      return { isValid: false, email: null, message: 'Token tidak valid' };
    }

     // Ambil email dari hasil query
     const email = resultSelect.email;

     console.log('Email yang diambil dari hasil query:', email);
     console.log('Nilai newPassword sebelum update:', newPassword);


     if (email === null || email === undefined) {
      console.log('Email tidak ditemukan atau tidak valid dalam hasil query.');
      return { isValid: false, email: null, message: 'Email tidak valid' };
    }

    console.log(newPassword)
    // Mengupdate password admin
    console.log('Mengupdate password dengan query:', 'UPDATE admin SET password = ? WHERE email = ?');
    const queryUpdate = 'UPDATE admin SET password = ? WHERE email = ?';
    const resultUpdate = await runQuery(queryUpdate, [newPassword, email]);
    console.log('Hasil update password:', resultUpdate);

    if (resultUpdate && resultUpdate.affectedRows !== undefined && resultUpdate.affectedRows === 1) {

    // // Opsional: Menghapus token reset setelah digunakan
    // const queryDelete = 'DELETE FROM admin_reset_tokens WHERE token = ?';
    // await runQuery(queryDelete, [token]);

    console.log('Password berhasil diupdate.');


    return { isValid: true, email, message: 'Password berhasil diupdate' };
  } else {
    console.log('Gagal mengupdate password.');
    return { isValid: false, email, message: 'Gagal mengupdate password' };
  }
} catch (error) {
  console.error('Error memeriksa validitas token reset dan mengupdate password:', error);
  console.error('Error stack trace:', error.stack);
  throw error;  
}
}



// Fungsi untuk menjalankan query ke database
async function runQuery(query, values = []) {
  return new Promise((resolve, reject) => {
    conn.query(query, values, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}


// Fungsi reset password kasir
async function updateKasirPassword(username, newPassword) {
  try {
    // SQL query to update the user's password (without hashing)
    const query = 'UPDATE users SET password = ? WHERE username = ?';
    
    // Execute the query with the plain text password
    const result = await runQuery(query, [newPassword, username]);

    // Check if the password was successfully updated
    if (result.affectedRows > 0) {
      console.log(`Password for user ${username} updated successfully.`);
      return true;
    } else {
      console.log(`Failed to update password for user ${username}. User not found.`);
      return false;
    }
  } catch (error) {
    console.error('Error updating user password:', error);
    throw error;
  }
}


function checkRole(role) {
  return (req, res, next) => {
    if (req.session.isLoggedIn && ((role === 'admin' && req.session.isAdmin) || (role === 'kasir' && !req.session.isAdmin))) {
      // Jika pengguna sesuai dengan peran yang diizinkan, lanjutkan ke tindakan berikutnya (next)
      next();
    } else {
      // Jika pengguna tidak sesuai dengan peran yang diizinkan, kembalikan mereka ke halaman login
      res.redirect('/');
    }
  };
}

async function checkLoggedIn(req, res, next) {
  if (req.session.isLoggedIn && req.session.isAdmin) {
      // Lanjutkan jika pengguna sudah login dan adalah admin
      next();
  } else {
      // Jika pengguna belum login atau bukan admin, arahkan mereka kembali ke halaman login
      res.redirect('/');
  }
}

// Fungsi untuk logout
async function logout() {
  const { logout } = req.body;

  if (logout === 'true') {
    // Hapus sesi pengguna (Anda perlu menggantinya dengan metode sesi yang digunakan dalam aplikasi Anda)
    req.session.destroy((err) => {
      if (err) {
        console.error('Error saat logout:', err);
        res.redirect('/dashboard'); // Redirect pengguna ke halaman utama jika terjadi kesalahan saat logout
      } else {
        console.log('Logout berhasil');
        res.redirect('/login'); // Redirect pengguna ke halaman login setelah logout
      }
    });
  } else {
    // Jika pengguna memilih "Batal", kembalikan ke halaman utama atau halaman lainnya
    res.redirect('/dashboard'); // Gantilah '/dashboard' dengan rute yang sesuai
  }
}


// Fungsi untuk login Admin
async function loginAdmin(username, inputPassword) {
  const query = 'SELECT password FROM admin WHERE username = ?';
  try {
    const [admin] = await runQuery(query, [username]);

    if (!admin) {
      console.log('User not found');
      return false;
    }

    // Membandingkan password input pengguna dengan password di database secara langsung
    const isPasswordValid = inputPassword === admin.password;

    console.log('Is Password Valid?', isPasswordValid);

    if (isPasswordValid) {
      console.log('Login berhasil');
      return true;
    } else {
      console.log('Password salah');
      return false;
    }
  } catch (error) {
    console.error('Error during login:', error);
    throw error;
  }
}

// Fungsi untuk memeriksa login
// async function loginAdmin(username, inputPassword) {
//   const query = 'SELECT password_hashed FROM admin WHERE username = ?';
//   try {
//     const [admin] = await runQuery(query, [username]);

//     if (!admin) {
//       console.log('User not found');
//       return false;
//     }

//     // Hash the input password using MD5
//     const hashedInputPassword = md5(inputPassword);

//     // Membandingkan password input pengguna dengan password di database secara langsung
//     const isPasswordValid = hashedInputPassword === admin.password_hashed;

//     console.log('Is Password Valid?', isPasswordValid);

//     if (isPasswordValid) {
//       console.log('Login berhasil');
//       return true;
//     } else {
//       console.log('Password salah');
//       return false;
//     }
//   } catch (error) {
//     console.error('Error during login:', error);
//     throw error;
//   }
// }


async function loadBook(){
  try{
    const query = 'SELECT kode_buku, judul, no_isbn, penulis, penerbit, tahun, stok, hrg_pokok, hrg_jual FROM buku WHERE status = ?';
      const values = ['aktif'];

      const result = await runQuery(query, values);
    // Kumpulkan buku yang mendekati habis
    const booksNearDepletion = result.filter(book => book.stok < 6);

    return { books: result, booksNearDepletion };
  } catch (error) {
    console.error(error.message);
    throw error;
  }
}


async function loadTransaksi(){
  try {
    const query = 'SELECT kode_transaksi, tgl_transaksi, total_pembelian, jumlah_pembayaran, kembalian FROM transaksi';

    const result = await runQuery(query);
    return result;
  } catch (error) {
    console.error(error.message);
    throw error;
  }
}



async function cariDataBuku(kataKunci) {
  const query = 'SELECT kode_buku, judul, no_isbn, penulis, penerbit, tahun, stok, hrg_pokok, hrg_jual FROM buku WHERE kode_buku LIKE ? OR judul LIKE ?';
  const values = [`%${kataKunci}%`, `%${kataKunci}%`];

  const hasilPencarian = await runQuery(query, values);
  return hasilPencarian;
}



async function tambahDataBuku(kodeBuku, judul, noISBN, penulis, penerbit, tahun, hargaPokok, hargaJual) {
  try {
    const query = `INSERT INTO buku (kode_buku, judul, no_isbn, penulis, penerbit, tahun, stok, hrg_pokok, hrg_jual)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const values = [kodeBuku, judul, noISBN, penulis, penerbit, tahun, 0, hargaPokok, hargaJual];

    await runQuery(query, values);

    console.log('hargaPokok:', hargaPokok);
    console.log(`Buku dengan kode ${kodeBuku} berhasil ditambahkan.`);
  } catch (error) {
    console.error('Error saat menambahkan data buku:', error);
    throw error;
    }
}

async function tambahStokBuku(kodeBuku, jumlahMasuk) {
  try {
    const query = 'UPDATE buku SET stok = stok + ? WHERE kode_buku = ?';
    const values = [jumlahMasuk, kodeBuku];

    await runQuery(query, values);

    console.log(`Stok buku dengan kode ${kodeBuku} telah ditambahkan sebanyak ${jumlahMasuk}.`);
  } catch (error) {
    console.error('Error saat menambah stok buku:', error);
    throw error;
  }
}



async function getBookByCode(kodeBuku) {
  try {
    const query = 'SELECT * FROM buku WHERE kode_buku = ?';
  
    const result = await runQuery(query, [kodeBuku]);

    if (result.length > 0) {
      return result[0];
    } else {
      throw new Error(`Book with code ${kodeBuku} not found`);
    }
  } catch (error) {
    console.error(`Error fetching book by code ${kodeBuku}:`, error);
    throw error;
  }
}


async function deleteDataBuku(kodeBuku) {
  try {
    // Langkah pertama: Hapus atau perbarui riwayat transaksi di tabel transaksi_detail
    const updateQuery = `
      UPDATE transaksi_detail 
      SET status = 'nonaktif' 
      WHERE id_judul = (SELECT id_buku FROM buku WHERE kode_buku = ?) AND status = 'aktif';
    `;
    await runQuery(updateQuery, [kodeBuku]);

    // Langkah kedua: Perbarui status menjadi 'nonaktif' di tabel buku
    const updateStatusQuery = 'UPDATE buku SET status = ? WHERE kode_buku = ?';
    await runQuery(updateStatusQuery, ['nonaktif', kodeBuku]);

    console.log(`Buku dengan kode ${kodeBuku} berhasil dinonaktifkan.`);
  } catch (error) {
    console.error('Error saat menghapus data buku:', error);
    throw error;
  }
}

// Contoh pengambilan dan pengolahan transaksi dengan mempertimbangkan status
async function fetchAndProcessTransactions() {
    try {
    // Contoh pengambilan semua transaksi aktif
    const query = 'SELECT * FROM transaksi_detail WHERE status = ?';
    const values = ['aktif'];
    const activeTransactions = await runQuery(query, values);

    // Contoh pemrosesan transaksi aktif
    activeTransactions.forEach((transaction) => {
      // Lakukan pemrosesan transaksi
      console.log('Memproses transaksi:', transaction);
    });
  } catch (error) {
    console.error('Terjadi kesalahan saat mengambil atau memproses transaksi:', error);
  }
};



async function updateDataBuku(kodeBuku, updatedData) {
  try {
    const query = 'UPDATE buku SET kode_buku = ?, judul = ?, no_isbn = ?, penulis = ?, penerbit = ?, tahun = ?, stok = ?, hrg_pokok = ?, hrg_jual = ? WHERE kode_buku = ?';

    const values = [updatedData.kodeBuku, updatedData.judul, updatedData.noISBN, updatedData.penulis, updatedData.penerbit, updatedData.tahun, updatedData.stok, updatedData.hargaPokok, updatedData.hargaJual, kodeBuku];
    
    const result = await runQuery(query, values);

    // Pastikan hasil update berhasil (gunakan affectedRows jika Anda menggunakan MySQL)
    if (result.affectedRows > 0) {
        console.log('Data buku berhasil diperbarui.');
        return true;
    } else {
        console.log('Data buku gagal diperbarui.');
        return false;
    }
  } catch (err) {
    console.error('Error:', err);
      return false; // Terjadi kesalahan
  }
}



async function loadUser(){
  try{
      const query = 'SELECT name, notlp, alamat, username, password FROM users';
      const result = await runQuery(query);
      return result;
  } catch (error) {
      console.error(error.message);
      throw error;
  }
}

async function findUserByUsername(username) {
  const query = 'SELECT name, username, password FROM users WHERE username = ?';
  const values = [username];
  const result = await runQuery(query, values);
  return result[0];
}


async function isUserAlreadyExists(newContact) {
  const query = 'SELECT * FROM users WHERE name = ? OR username = ? OR password = ?';
  const values = [newContact.name, newContact.username, newContact.password];
  const result = await runQuery(query, values);
  return result.length > 0;
}

async function saveUser(name, notlp, alamat, username, password) {
  try {
    // Periksa apakah pengguna dengan username yang sama sudah ada dalam database
    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      console.log('User sudah ada dalam daftar.');
      return;
    }

    const query = 'INSERT INTO users (name, notlp, alamat, username, password) VALUES (?, ?, ?, ?, ?)';
    const values = [name, notlp, alamat, username, password];

    // Jalankan query SQL untuk menyimpan data ke dalam database
    await runQuery(query, values);

    console.log('User berhasil ditambahkan.');
  } catch (error) {
    console.error('Error saat menambahkan data user:', error);
    throw error;
  }
}



  async function updateUser(username, updatedUser) {
    try {
      // Periksa apakah kontak dengan username yang sama sudah ada dalam database
      const existingUser = await findUserByUsername(username);
      if (!existingUser) {
        console.log('User tidak ditemukan.');
        return false;
      }

      // Validasi password jika diperlukan

      const query = 'UPDATE users SET name = ?, notlp = ?, alamat = ?, username = ?, password = ? WHERE username = ?';
      const values = [updatedUser.name, updatedUser.notlp, updatedUser.alamat, updatedUser.username, updatedUser.password, username];
      const result = await runQuery(query, values);

      if (result.affectedRows > 0) {
        console.log('User berhasil diperbarui.');
        return true;
      } else {
        console.log('User gagal diperbarui.');
        return false;
      }
    } catch (err) {
      console.error('Error saat memperbarui data pengguna:', err);
      throw err;
    }
  }


  async function deleteUser(username) {
    try {
      // Periksa apakah kontak dengan username yang ingin dihapus ada
      const existingUser = await findUserByUsername(username);
      if (!existingUser) {
        console.log('User tidak ditemukan.');
        return false;
      }
      const query = 'DELETE FROM users WHERE username = ?';
      const values = [username];
      await runQuery(query, values);
      console.log(`User dengan username ${username} berhasil dihapus.`);
    } catch (err) {
      console.error('Error:', err);
    }
  }


// Fungsi untuk mengambil data riwayat transaksi
async function riwayatTransaksi() {
  try {
    // Query untuk mengambil data riwayat transaksi dari tabel transaksi dan transaksi_detail
    const query = `
      SELECT
        t.kode_transaksi,
        t.tgl_transaksi,
        t.total_pembelian,
        t.jumlah_pembayaran,
        t.kembalian,
        b.judul,
        td.namaPelanggan,
        COUNT(td.kode_buku) AS jumlah_item,
        GROUP_CONCAT(td.kode_buku, ':', td.id_judul, ':', td.jumlah_beli, ':', td.hrg_pokok, ':', td.hrg_jual, ':', td.status SEPARATOR ';') AS detail_transaksi
      FROM
        transaksi t
      JOIN
        transaksi_detail td ON t.kode_transaksi = td.kode_transaksi
      JOIN
        buku b ON td.kode_buku = b.kode_buku
      GROUP BY
        t.kode_transaksi
      ORDER BY
        t.tgl_transaksi DESC`;

    const results = await runQuery(query);
    return results;
  } catch (error) {
    throw error;
  }
}

// Fungsi untuk mencari riwayat transaksi berdasarkan kurun waktu
async function cariRiwayatTransaksi(startDate, endDate) {
  try {
    
    // Query untuk mencari riwayat transaksi berdasarkan kurun waktu dari tabel transaksi dan transaksi_detail
    const query = `
      SELECT
        t.kode_transaksi AS transaksi_kode_transaksi,
        t.tgl_transaksi,
        t.total_pembelian,
        t.jumlah_pembayaran,
        t.kembalian,
        b.judul,
        td.namaPelanggan,
        COUNT(td.kode_buku) AS jumlah_item,
        GROUP_CONCAT(
          CONCAT(td.kode_buku, ':', td.id_judul, ':', td.jumlah_beli, ':', td.hrg_pokok, ':', td.hrg_jual, ':', td.status) SEPARATOR ';'
        ) AS detail_transaksi        
      FROM
        transaksi t
      JOIN
        transaksi_detail td ON t.kode_transaksi = td.kode_transaksi
      JOIN
        buku b ON td.kode_buku = b.kode_buku
      WHERE
        t.tgl_transaksi BETWEEN ? AND ?
      GROUP BY
        t.kode_transaksi
      ORDER BY
        t.tgl_transaksi DESC`;

    const results = await runQuery(query, [startDate, endDate]);
    console.log('Query results:', results);
    return results;
  } catch (error) {
    throw error;
  }
}



// async function getTransactionHistory() {
//   const query = `
//   SELECT transaksi_detail.*, buku.judul AS judulBuku
//   FROM transaksi_detail
//   JOIN barang ON transaksi_detail.id_judul = buku.id_buku
//   WHERE transaksi_detail.kodeTransaksi IS NOT NULL
//   ORDER BY transaksi_detail.tanggal DESC;
//   `;
//   try {

//       const history = await result(query);
//       console.log(history);
//       return history;
//   } catch (error) {
//       console.error(error.message);
//       throw error;
//   }
// }

// async function getTransactionHistoryByDateRange(startDate, endDate) {
//   const query = `
//   SELECT transaksi_detail.*, buku.judul AS judulBuku
//   FROM transaksi_detail
//   JOIN barang ON transaksi_detail.id_judul = buku.id_buku
//   WHERE transaksi_detail.kodeTransaksi IS NOT NULL
//   AND transaksi_detail.tanggal BETWEEN ? AND ?
//   ORDER BY transaksi_detail.tanggal DESC;
//   `;

//   try {
//       const history = await result(query, [startDate, endDate]);
//       console.log(history);
//       return history;
//   } catch (error) {
//       console.error(error.message);
//       throw error;
//   }
// }

async function updateRiwayatTransaksi(kodeBuku, updatedBuku) {
  try {
    // Ambil data riwayat transaksi yang terkait dengan buku yang diupdate
    const selectQuery = `
      SELECT
        kode_transaksi,
        tgl_transaksi,
        COUNT(kode_buku) AS jumlah_item,
        GROUP_CONCAT(kode_buku, ':', id_judul, ':', jumlah_beli, ':', hrg_pokok, ':', hrg_jual SEPARATOR ';') AS detail_transaksi
      FROM
        transaksi
      JOIN
        transaksi_detail ON transaksi.kode_transaksi = transaksi_detail.kode_transaksi
      WHERE
        kode_buku = ?
      GROUP BY
        kode_transaksi
      ORDER BY
        tgl_transaksi DESC`;

    const selectValues = [kodeBuku];
    const existingTransaksi = await runQuery(selectQuery, selectValues);

    if (existingTransaksi.length > 0) {
      // Ada riwayat transaksi terkait, perbarui nama buku di masing-masing entri
      const updateRiwayatQuery = 'UPDATE transaksi_detail SET judul = ? WHERE kode_transaksi = ? AND kode_buku = ?';

      for (const transaksi of existingTransaksi) {
        const updateValues = [updatedBuku.judul, transaksi.kode_transaksi, kodeBuku];
        await runQuery(updateRiwayatQuery, updateValues);
      }

      console.log('Riwayat transaksi berhasil diperbarui.');
      return true;
    } else {
      console.log('Tidak ada riwayat transaksi yang terkait dengan buku ini.');
      return false;
    }
  } catch (err) {
    console.error('Error:', err);
    return false; // Terjadi kesalahan
  }
}






module.exports = {
  runQuery, 
  checkRole,
  logout,
  checkLoggedIn,
  loginAdmin,
  sendPasswordResetEmail,
  generateResetToken,
  // removeResetToken,
  resetPassword,
  // updateUserPassword,
  saveResetToken,
  isValidResetToken,
  verifyAdminEmail,
  updateKasirPassword,
  loadBook,
  getBookByCode,
  tambahDataBuku,
  tambahStokBuku,
  deleteDataBuku,
  cariDataBuku,
  updateDataBuku,
  loadUser,
  findUserByUsername,
  isUserAlreadyExists,
  saveUser,
  updateUser,
  deleteUser,
  loadTransaksi,
  riwayatTransaksi,
  updateRiwayatTransaksi,
  cariRiwayatTransaksi,
  // getTransactionHistory,
  // getTransactionHistoryByDateRange,
  fetchAndProcessTransactions };



