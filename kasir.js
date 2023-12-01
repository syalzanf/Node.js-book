const validator = require('validator');
const readline = require("readline");
const fs = require('fs');
const conn = require('./configdb');
const nodemailer = require('nodemailer');



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
 
  // Konfigurasi transporter (gunakan transporter email yang sesuai dengan kebutuhan Anda)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
      user: 'lisneni76@gmail.com',
      pass: 'mamah110'
  }
});

async function findKasirByUsername(username) {
  try {
    console.log('Searching for Kasir with username:', username);
    // Lakukan pencarian kasir berdasarkan username di database
    const query = 'SELECT * FROM users WHERE username = ?';

    const [kasirData] = await runQuery(query, [username]);

    // Mengembalikan data kasir jika ditemukan
    if (kasirData.length > 0) {
      return kasirData[0];
    } else {
      return null; // Kasir tidak ditemukan
    }
  } catch (error) {
    console.error('Error finding kasir by username:', error);
    throw error; // Dilempar kembali untuk penanganan kesalahan di tingkat yang lebih tinggi
  }
}



// Fungsi untuk memeriksa login
async function loginKasir(username, inputPassword) {
  const query = 'SELECT password FROM users WHERE username = ?';
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



  
  async function initiatePasswordReset(username) {
  // Periksa apakah kasir dengan username tersebut ada di database
  const kasir = await findKasirByUsername(username);

  if (!kasir) {
    console.log('Kasir not found for the given username.');
    return false;
  }

    // Buat token reset password dan simpan di database
    const resetToken = generateResetToken(); // Implementasikan cara Anda menghasilkan token reset
    const saveTokenQuery = 'UPDATE users SET reset_token = ? WHERE email = ?';
    await runQuery(saveTokenQuery, [resetToken, username]);

    // Kirim email notifikasi ke admin
    sendResetNotificationToAdmin(email, resetToken, username); // Implementasikan cara Anda memberi tahu admin
    console.log('Password reset initiated. Check your email for further instructions.');
    return true;
}

async function generateResetToken() {
  const tokenLength = 20; // Panjang token yang diinginkan

  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';

  for (let i = 0; i < tokenLength; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      token += characters.charAt(randomIndex);
  }

  return token;
}

// Fungsi untuk mengirim email ke admin
async function sendResetNotificationToAdmin(email, resetToken, username) {
  const mailOptions = {
      from: 'liseni76@gmail.com',
      to: 'nfsyalza@gmail.com',
      subject: 'Password Reset Request',
      text: `Kasir dengan username ${username} meminta reset password.Reset token: ${resetToken}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
          console.error('Error sending notification to admin:', error);
      } else {
          console.log('Notification sent to admin:', info.response);
      }
  });
}



// Fungsi untuk menghasilkan kode transaksi baru
async function generateKodeTransaksi() {
  try {
    // Query untuk mendapatkan kode transaksi terakhir
    const lastIDQuery = 'SELECT MAX(kode_transaksi) AS lastID FROM transaksi';
    const lastIDResult = await runQuery(lastIDQuery);

    const lastID = lastIDResult[0].lastID || 0; // Mengambil ID terakhir atau default 0 jika belum ada data
    const nextID = lastID + 1;
    const kodeTransaksi = String(nextID); // Menggunakan format yang sesuai dengan tabel transaksi

    return kodeTransaksi;
  } catch (error) {
    console.error('Error saat menghasilkan kode penjualan:', error);
    throw error;
  }
}

async function loadBook(){
  try{
      const query = 'SELECT kode_buku, judul, no_isbn, penulis, penerbit, tahun, stok, hrg_pokok, hrg_jual FROM buku';

      const result = await runQuery(query);
      return result;
  } catch (error) {
      console.error(error.message);
      throw error;
  }
}

// Fungsi untuk mengambil informasi buku berdasarkan kode buku
async function getBookInfo(kodeBuku, jumlahBeli) {
  const query = 'SELECT kode_buku, judul, stok, hrg_pokok, hrg_jual FROM buku WHERE kode_buku = ?';

  try {
    const result = await runQuery(query, [kodeBuku]);

    if (result.length === 0) {
      console.log(`Buku dengan kode ${kodeBuku} tidak ditemukan.`);
      return { error: `Buku dengan kode ${kodeBuku} tidak ditemukan.` };
    } else {
      const bookInfo = result[0];
      console.log('Data buku yang ditemukan:', bookInfo);

      // Validasi jumlah beli
      if (jumlahBeli > bookInfo.stok) {
        console.log(`Jumlah buku yang dibeli melebihi stok buku ${kodeBuku}.`);
        return { error: `Jumlah buku yang dibeli melebihi stok buku ${kodeBuku}.` };
      } else if (jumlahBeli <= 0) {
        console.log(`Jumlah buku yang dibeli tidak valid.`);
        return { error: `Jumlah buku yang dibeli tidak valid.` };
      }

      // Validasi stok buku
      if (bookInfo.stok === 0) {
        console.log(`Stok buku ${kodeBuku} habis.`);
        return { error: `Stok buku ${kodeBuku} habis.` };
      } else if (bookInfo.stok < 0) {
        console.log(`Stok buku ${kodeBuku} tidak valid.`);
        return { error: `Stok buku ${kodeBuku} tidak valid.` };
      }
      return bookInfo;
    }
  } catch (error) {
    console.error('Terjadi kesalahan dalam mengambil informasi buku:', error);
    throw { error: 'Terjadi kesalahan dalam mengambil informasi buku' };
  }
}



// Deklarasikan keranjang sebagai array kosong
const keranjang = [];
async function tambahTransaksi(kodeTransaksi, kodeBuku, jumlahBeli, namaPelanggan) {
  try {
    const getBookQuery = 'SELECT kode_buku, judul, stok, hrg_pokok, hrg_jual FROM buku WHERE kode_buku = ?';
    const getBookValues = [kodeBuku];
    const bookResult = await runQuery(getBookQuery, getBookValues);

    if (bookResult.length === 0) {
      console.error(`Buku dengan kode ${kodeBuku} tidak ditemukan.`);
      return null;
    }

    const { stok, hrg_pokok, hrg_jual, judul } = bookResult[0];

    if (jumlahBeli <= 0) {
      console.error('Jumlah beli harus lebih dari 0.');
      return null;
    }

    if (jumlahBeli > stok) {
      console.error('Jumlah beli melebihi stok yang tersedia.');
      return null;
    }
    // Hitung total berdasarkan harga beli
    const subTotal = jumlahBeli * hrg_jual;

    // Tambahkan data transaksi ke dalam keranjang
    keranjang.push({
      kodeTransaksi,
      kodeBuku,
      judul,
      jumlahBeli,
      namaPelanggan,
      hargaPokok: hrg_pokok,
      hargaJual: hrg_jual,
      subTotal,
      stok,
      
    });

    console.log('Buku berhasil ditambahkan ke keranjang.');
  } catch (error) {
    console.error('Error saat menambahkan transaksi:', error);
    throw error;
  }
}


function hitungTotal() {
  let total = 0;
  for (const item of keranjang) {
    total += item.subTotal;
  }
  return total;
}



// Fungsi untuk menyimpan data transaksi utama ke dalam tabel 'transaksi'
async function simpanTransaksiUtama(kodeTransaksi, totalPembelian, jumlahPembayaran, kembalian) {
  try {
    const insertQuery = `
      INSERT INTO transaksi 
      (kode_transaksi, tgl_transaksi, total_pembelian, jumlah_pembayaran, kembalian)
      VALUES (?, NOW(), ?, ?, ?)`;

    const values = [kodeTransaksi, totalPembelian, jumlahPembayaran, kembalian];

    await runQuery(insertQuery, values); // Menggun akan fungsi runQuery yang sudah ada

    // Mengembalikan nilai kode transaksi setelah operasi penyimpanan
    return kodeTransaksi;
    console.log('Data transaksi utama berhasil disimpan.');

  } catch (error) {
    console.error('Error saat menyimpan data transaksi utama:', error);
  }
}

// Fungsi untuk menyimpan data detail transaksi ke dalam tabel 'transaksi_detail'
async function simpanDetailTransaksi(kodeTransaksi, namaPelanggan, kodeBuku, judul, jumlahBeli, hrgPokok, hrgJual) {
  try {
    // Pastikan ID buku yang dikirim sesuai dengan ID yang ada di tabel buku
    const checkBookQuery = `SELECT id_buku FROM buku WHERE kode_buku = ?`;
    const [foundBook] = await runQuery(checkBookQuery, [kodeBuku]); // Menggunakan kodeBuku yang benar
    
    if (!foundBook) {
      console.error(`Data buku dengan kode ${kodeBuku} tidak ditemukan.`);
      return;
    }

    const insertQuery = `
      INSERT INTO transaksi_detail 
      (kode_transaksi,  id_judul, namaPelanggan, kode_buku, jumlah_beli, hrg_pokok, hrg_jual)
      VALUES (?, ?, ?, ?, ?, ?, ?)`;

    const values = [kodeTransaksi, foundBook.id_buku, namaPelanggan, kodeBuku, jumlahBeli, hrgPokok, hrgJual];

    await runQuery(insertQuery, values); // Menggunakan fungsi runQuery yang sudah ada
    console.log('Data detail transaksi berhasil disimpan.');
  } catch (error) {
    console.error('Error saat menyimpan data detail transaksi:', error);
  }
}



// Fungsi untuk proses pembayaran (menggunakan transaksi utama)
async function prosesPembayaran(kodeTransaksi, jumlahPembayaran) {
  try {
    console.log('Memulai proses pembayaran...');

    // Memanggil fungsi generateKodeTransaksi() untuk mendapatkan kode transaksi yang sama
    const kodeTransaksi = await generateKodeTransaksi();

     // Memanggil fungsi hitungTotal() untuk menghitung total pembelian
     const totalPembelian = hitungTotal();

    // // Mengkonversi input menjadi angka (pastikan menggunakan angka desimal jika diperlukan)
    // console.log('Nilai totalPembelian sebelum parsing:', totalPembelian);
    // console.log('Nilai jumlahPembayaran sebelum parsing:', jumlahPembayaran);
    
    const totalPembelianAmount = parseFloat(totalPembelian);
    const jumlahPembayaranAmount = parseFloat(jumlahPembayaran);
    
    // console.log('Nilai totalPembelianAmount setelah parsing:', totalPembelianAmount);
    // console.log('Nilai jumlahPembayaranAmount setelah parsing:', jumlahPembayaranAmount);
    
    // Validasi input
    if (isNaN(totalPembelianAmount) || isNaN(jumlahPembayaranAmount) || jumlahPembayaranAmount < totalPembelianAmount) {
      throw new Error('Jumlah pembayaran tidak valid');
    }

    // Hitung kembalian
    const kembalian = jumlahPembayaranAmount - totalPembelianAmount;
    
    // Simpan data transaksi utama dan tangkap kode_transaksi yang dikembalikan
    const kodeTransaksiUtama = await simpanTransaksiUtama(kodeTransaksi, totalPembelian, jumlahPembayaran, kembalian);

    console.log('Nilai kodeTransaksiUtama yang diperoleh dari simpanTransaksiUtama():', kodeTransaksiUtama);

    // Validasi stok sebelum menyimpan transaksi
    const isStokCukup = await validasiStokTransaksi(keranjang);

    if (!isStokCukup) {
      console.error('Stok buku tidak mencukupi.');
      return null;
    }
    console.log('Melakukan penyimpanan detail transaksi...');

    // Simpan data detail transaksi jika ada item di keranjang dengan menggunakan kode_transaksi yang telah diperoleh
    for (const item of keranjang) {
      await simpanDetailTransaksi(
        kodeTransaksiUtama, // Gunakan kode_transaksi yang telah diperoleh
        item.namaPelanggan,
        item.kodeBuku,
        item.judul,
        item.jumlahBeli,
        item.hargaPokok,
        item.hargaJual
      );
    }

    // Setelah loop di atas, kurangi stok buku
    for (const item of keranjang) {
      await kurangiStokBuku(item.kodeBuku, item.jumlahBeli);
    }

    // Hapus keranjang setelah transaksi selesai
    keranjang.length = 0;

    console.log('Pembayaran berhasil.');
    return kembalian;
  } catch (error) {
    console.error('Error saat melakukan pembayaran:', error);
    throw error;
  }
}

async function resetKeranjang() {
  keranjang.length = 0;
  console.log('Keranjang transaksi berhasil direset.');
}

// Fungsi untuk validasi stok sebelum transaksi
async function validasiStokTransaksi(transaksiItems) {
  for (const item of transaksiItems) {
    const { kodeBuku, jumlahBeli, stok } = item;

    if (jumlahBeli > stok) {
      return false; // Jika stok tidak mencukupi, kembalikan false
    }
  }
  return true; // Jika semua validasi stok berhasil, kembalikan true
}
async function kurangiStokBuku(kodeBuku, jumlahBeli) {
  try {
    for (const item of keranjang) {
      const { kodeBuku, jumlahBeli } = item;
      const query = 'UPDATE buku SET stok = stok - ? WHERE kode_buku = ?';
      const values = [jumlahBeli, kodeBuku];
    await runQuery(query, values);
    }
    console.log(`Stok buku dengan kode ${kodeBuku} telah dikurangkan sebanyak ${jumlahBeli}.`);
  } catch (error) {
    console.error('Error saat mengurangkan stok buku:', error);
    throw error;
  }
}




  module.exports = {
      checkRole, 
      runQuery,
      findKasirByUsername,
      loginKasir,
      initiatePasswordReset,
      sendResetNotificationToAdmin,
      generateResetToken,    
      generateKodeTransaksi,
      loadBook,
      getBookInfo,
      tambahTransaksi,
      keranjang,
      resetKeranjang,
      hitungTotal,
      simpanTransaksiUtama,
      simpanDetailTransaksi,
      prosesPembayaran,
      validasiStokTransaksi,
      kurangiStokBuku,

    };
