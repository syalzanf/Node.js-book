const express = require('express');
const app = express();
const session = require('express-session');
const bodyParser = require('body-parser');
const port = 3000;
const conn = require("./configdb");
const admin = require('./admin');
const kasir = require('./kasir');
const nodemailer = require('nodemailer');
const moment = require('moment');

const options = {
  dotfiles: 'ignore',
  etag: false,  
  extensions: ['htm', 'html'],
  index: false,
  maxAge: '1d',
  redirect: false,
  setHeaders: function (res, path, stat) {
    res.set('x-timestamp', Date.now())
  }
}

// Middleware untuk mengatur direktori tampilan statis
app.use(express.static('public'));

// Konfigurasi session
app.use(session({
    secret: 'SY4L11', // Ganti dengan kunci rahasia yang kuat
    resave: false,
    saveUninitialized: true,
}));

// Pengaturan template engine
app.set('view engine', 'ejs');

// Middleware untuk parsing data yang dikirimkan melalui body
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'nfsyalza@gmail.com',
    pass: 'atmp lfce lugq yjew',
  },
});

// Rute untuk form reset password admin
app.get('/forgotPassword-admin', async (req, res) => {
  const message = "Enter your email address";
  // Render halaman untuk reset password admin
  res.render('forgotPassword-admin', { message });
});

// Rute untuk penanganan reset password admin
app.post('/forgotPassword-admin', async (req, res) => {
  try {
    const userEmail = req.body.email;

    // Generate a unique reset token
    const token = await admin.generateResetToken();

    // Save the reset token to the database
    await admin.saveResetToken(userEmail, token);

    // Konstruksi resetLink
    const resetLink = `http://localhost:3000/reset-password/${token}`;

    // Konfigurasi mailOptions dengan email penerima dan resetLink
    const mailOptions = {
      from: 'nfsyalza@gmail.com',
      to: userEmail,
      subject: 'Reset Password',
      text: `Untuk mereset password Anda, klik tautan berikut: ${resetLink}`,
      html: `<p>Untuk mereset password Anda, klik tautan berikut: <a href="${resetLink}">${resetLink}</a></p>`,
    };

    // Kirim email
    const info = await transporter.sendMail(mailOptions);

    console.log('Email terkirim:', info.response);

    // Tanggapi dengan pesan keberhasilan atau redirect ke halaman konfirmasi
    res.status(200).send('Email reset password berhasil dikirim.');
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Gagal mengirim email reset password.');
  }
});



// Halaman reset password
app.get('/reset-password/:token', async (req, res) => {
  const token = req.params.token;

  try {
    // Periksa apakah token ada di database
    const { isValid, email } = await admin.resetPassword(token);

    if (!isValid) {
      // Token tidak ditemukan atau sudah digunakan
      return res.send('Invalid or expired reset token.');
    }

    // Render halaman reset password dengan token dan email
    res.render('resetPassword-admin', { title: 'Reset Password', token: token, email: email });
  } catch (error) {
    console.error('Error saat menampilkan halaman reset password:', error);
    res.send('Terjadi kesalahan saat memeriksa token reset password.');
  }
});

// Proses reset password
app.post('/resetPassword/:token', async (req, res) => {
  const token = req.params.token;
  const newPassword = req.body.newPassword;
  const email = req.body.email;

  try {
    // Periksa apakah token ada di database
    const { isValid, email } = await admin.resetPassword(token);

    if (!isValid) {
      // Token tidak ditemukan atau sudah digunakan
      console.log('Token tidak valid atau sudah digunakan.');
      return res.send('Invalid or expired reset token.');
    }

    // Update password pengguna di database
    const updateResult = await admin.updateUserPassword(email, newPassword);

    if (updateResult.affectedRows === 0) {
      throw new Error('Gagal memperbarui password.');
    }

    // Hapus token reset dari database
    await admin.removeResetToken(token);

    res.render('password-reset-success', { title: 'Reset Password' });
  } catch (error) {
    console.error('Error saat mereset password:', error);
    res.send('Terjadi kesalahan saat mereset password.');
  }
});

// Rute untuk verifikasi email admin
app.get('/verify-email', async (req, res) => {
  const emailToVerify = 'nfsyalza@gmail.com';
  
  try {
    const isEmailValid = await admin.verifyAdminEmail(emailToVerify);
    console.log('Is Email Valid:', isEmailValid);
    
    // Lakukan tindakan berdasarkan hasil verifikasi email
    if (isEmailValid) {
      res.send('Email valid!');
    } else {
      res.send('Email tidak valid!');
    }
  } catch (error) {
    console.error('Terjadi kesalahan:', error);
    res.status(500).send('Terjadi kesalahan.');
  }
});



// // Rute untuk menampilkan halaman reset password admin
// app.get('/reset-password/:token', async (req, res) => {
//   const { token } = req.params;

//   if (!token || !(await admin.isValidResetToken(token))) {
//     console.error('Invalid or expired reset token for token:', token);
//     return res.status(400).send('Invalid or expired reset token.');
//   }

//   res.render('resetPassword-admin', { token });
// });

// // Rute untuk menangani reset password admin
// app.post('/reset-password/:token', async (req, res) => {
//   const { token } = req.params;
//   const { password, confirmPassword } = req.body;

//   try {
//     console.log('Reset Password Function - Received Token:', token);

//     // Memeriksa apakah password dan konfirmasi password cocok
//     if (password !== confirmPassword) {
//       return res.status(400).send('Password dan konfirmasi password tidak cocok.');
//     }

//     // Memeriksa kevalidan token sebelum menghapusnya dari database
//     const isTokenValid = await admin.isValidResetToken(token);

//     if (!isTokenValid) {
//       return res.status(400).send('Token reset tidak valid atau sudah kedaluwarsa.');
//     }

//     // Memanggil fungsi removeResetToken dan resetPassword
//     const email = await admin.resetPassword(token, password); // Mereset password

//     await admin.removeResetToken(token); // Menghapus token dari database
   
//     res.send(`Password untuk email ${email} berhasil direset.`);
//   } catch (error) {
//     console.error('Error reset password:', error);
//     res.status(500).send('Terjadi kesalahan saat mereset password.');
//   }
// });




// Rute untuk logout
app.post('/logout', async (req, res) => {
  await admin.logout();
  res.redirect('/');
});

// Halaman login untuk admin dan kasir
app.get('/', (req, res) => {
  const errorMessage = 'Username atau password salah. Coba Lagi!';
  res.render('login', { nama: 'syalza', title: 'Halaman Login', error: errorMessage });
});


// Rute untuk penanganan login
app.post('/login', async (req, res) => {
  const { role, username, password } = req.body;
  console.log('Received POST request to /login');
  console.log('Role:', role);
  console.log('Username:', username);
  console.log('Password:', password);

  // Lakukan verifikasi login menggunakan fungsi loginAdmin dan loginKasir
  if (role === 'admin') {
      const isAdmin = await admin.loginAdmin(username, password);
      if (isAdmin) {
          // Setel sesi login sebagai admin jika login berhasil
          req.session.isLoggedIn = true;
          req.session.isAdmin = true;
          req.session.username = username;
          res.redirect('/home');
          return;
      }
  } else if (role === 'kasir') {
      const isKasir = await kasir.loginKasir(username, password);
      if (isKasir) {
          // Setel sesi login sebagai kasir jika login berhasil
          req.session.isLoggedIn = true;
          req.session.isAdmin = false;
          req.session.username = username;
          res.redirect('/transaksi');
          return;
      }else {
        // Menampilkan alert jika login gagal
        console.log("Username atau Password Salah")
        const errorMessage = 'Username atau password salah. Coba Lagi!';
        res.render('login', { error: errorMessage });
        }
    }
  // Redirect kembali ke halaman login jika login gagal
  res.redirect('/');
});







// Rute untuk halaman konfirmasi
app.get('/confirmation', (req, res) => {
  const confirmationMessage = 'Password reset successfully. You can now login with your new password.';
  res.render('confirmation', { message: confirmationMessage });
});



// // Rute untuk lupa kata sandi kasir
// app.get('/forgot-password', async (req, res) => {
//   const message = "Masukkan Username Kasir";
//   // Render halaman untuk lupa kata sandi kasir
//   res.render('forgotPassword-kasir', { message });
// });

// // Rute untuk penanganan lupa kata sandi Admin
// app.post('/forgot-password', async (req, res) => {
//   const { username } = req.body;
//   console.log('Received username from form:', username);

//   try {
//       const kasirData = await kasir.findKasirByUsername(username);
//       console.log('Kasir Data:', kasirData);
//       console.log('Admin Email:', adminEmail);

//       if (kasirData) {
//           // Kirim notifikasi ke admin bahwa kasir meminta reset password
//           kasir.sendResetNotificationToAdmin(username, adminEmail);

//           res.send('Password reset process initiated. Check your email for further instructions.');
//       } else {
//           res.status(404).send('Kasir not found.');
//       }
//   } catch (error) {
//       console.error('Error initiating password reset:', error);
//       res.status(500).send('Internal Server Error');
//   }
// });



// Halaman utama untuk admin
app.get('/home', admin.checkRole('admin'), admin.checkLoggedIn, (req, res) => {
  if (req.session.isLoggedIn && req.session.isAdmin) {
      // Tampilkan halaman homeAdmin hanya jika pengguna sudah login dan adalah admin
      res.render('home', { username: req.session.username, title: 'Halaman Admin' });
  } else {
      // Redirect ke halaman login jika belum login atau bukan admin
      res.redirect('/');
  }
});


// Rute untuk menampilkan semua data buku
app.get('/dataBuku', admin.checkLoggedIn, async (req, res) => {
  try {
      const booksData = await admin.loadBook();
      const books = booksData.books; // Dapatkan daftar buku dari hasil fungsi loadBook
      const booksNearDepletion = booksData.booksNearDepletion; // Dapatkan buku yang mendekati habis

      // Render halaman 'dataBuku' dengan data buku dan notifikasi buku mendekati habis
      res.render('dataBuku', {
          title: 'Book page',
          cont: books,
          updateSuccess: false,
          booksNearDepletion: booksNearDepletion
      });
  } catch (error) {
      console.error(error.message);
      res.status(500).send('Terjadi kesalahan dalam memuat data buku.');
  }
});



// Route untuk menambah data buku
app.post('/dataBuku/add', async (req, res) => {
  const { kodeBuku, judul, noISBN, penulis, penerbit, tahun, stok, hargaPokok, hargaJual } = req.body;

  // Lakukan tindakan penyimpanan data ke dalam database
  try {
      await admin.tambahDataBuku(kodeBuku, judul, noISBN, penulis, penerbit, tahun, hargaPokok, hargaJual);
      res.redirect('/dataBuku');
  } catch (error) {
      console.error('Gagal menambahkan data buku:', error);
      res.status(500).send('Terjadi kesalahan saat menambahkan data buku.');
  }
});

//Rute untuk ke halaman tambah stok
app.get('/dataBuku/tambahStok/:kodeBuku', async (req, res) => {
  const { kodeBuku } = req.params;
  console.log('Kode buku yang diterima:', kodeBuku);
  const buku = await admin.getBookByCode(kodeBuku);
  res.render('tambahStok',  { title: 'Tambah stok page', kodeBuku, buku }); 
});

// rute untuk menambah stok buku
app.post('/dataBuku/tambahStok/:kodeBuku', async (req, res) => {
  const { kodeBuku } = req.params; 
  const { jumlahMasuk } = req.body;

  await admin.tambahStokBuku(kodeBuku, jumlahMasuk)
  res.redirect('/dataBuku'); 
});


// Rute untuk menghapus buku berdasarkan kode buku
app.post('/dataBuku/delete/:kodeBuku', async (req, res) => {
  const kodeBuku = req.params.kodeBuku; 
  await admin.deleteDataBuku(kodeBuku); // Menggunakan deleteDataBuku dengan kodeBuku sebagai argumen
  console.log(`Menghapus buku dengan kode: ${kodeBuku}`);
  res.redirect('/dataBuku');
});

// Rute untuk mencari data buku berdasarkan kata kunci
app.post('/dataBuku/cari', async (req, res) => {
  const { kataKunci } = req.body;

  try {
      const bukuDicari = await admin.cariDataBuku(kataKunci); // Menggunakan fungsi cariDataBuku
      res.render('hasilPencarian', { hasilPencarian: bukuDicari, title: 'Search Book Page' }); // Menampilkan hasil pencarian di halaman hasilPencarian.ejs
  } catch (error) {
      console.error('Error saat mencari data buku:', error);
      res.status(500).send('Terjadi kesalahan saat mencari data buku.');
  }
});

app.get('/dataBuku/update/:kodeBuku', async (req, res) => {
  const kodeBuku = req.params.kodeBuku;
  const buku = await admin.getBookByCode(kodeBuku);

  if (!buku) {
    res.status(404).send('Buku tidak ditemukan');
    return;
  }

  res.render('hasilPencarian', { buku, title: 'Halaman Update Buku' });
});

// Rute untuk mengupdate data buku berdasarkan kode buku
app.post('/update-buku/:kodeBuku', async (req, res) => {
  const buku = req.params.kodeBuku;
  const { kodeBuku, judul, noISBN, penulis, penerbit, tahun, stok, hargaPokok, hargaJual } = req.body;
  const updatedBuku = { kodeBuku, judul, noISBN, penulis, penerbit, tahun, stok, hargaPokok, hargaJual}; 

  const success = await admin.updateDataBuku(buku, updatedBuku);

  if (success) {
    await admin.updateRiwayatTransaksi(buku, updatedBuku);

    res.redirect('/dataBuku');
  } else {
    res.status(404).send('Book not found or update failed.');
  }
});



// Rute untuk menampilkan semua data User
app.get('/dataUser', admin.checkLoggedIn, async (req, res) => {
  const users = await admin.loadUser();
  console.log(users)
  res.render('dataUser', { title:`data user page`, users : users});
});

// Rute untuk halaman tambah user
app.get('/dataUser/add', async (req, res) => {
  res.render('dataUser', { title: 'Data User' });
});
app.post('/dataUser/add', async (req, res) => {
  const { name, notlp, alamat, username, password } = req.body;
  await admin.saveUser(name, notlp, alamat, username, password);
  res.redirect('/dataUser');
});

// Rute untuk menghapus kontak berdasarkan nama
app.post('/dataUser/delete/:username', async (req, res) => {
  const username = req.params.username;
  await admin.deleteUser(username);
  console.log(`Menghapus kontak dengan username: ${username}`);
  res.redirect('/dataUser'); // Mengarahkan kembali ke halaman /dataUser
});

// Rute untuk menampilkan form reset password kasir
app.get('/dataUser/reset-password/:username', async (req, res) => {
  const username = req.params.username;
  const user = await admin.findUserByUsername(username);
  if (!user) {
    res.status(404).send('Pengguna tidak ditemukan.');
    return;
  }
  res.render('resetPassword', { title: 'Reset password page', user });
});

// Rute untuk mengirimkan permintaan pengaturan ulang password kasir
app.post('/dataUser/reset-pswd/:username', async (req, res) => {
  const username = req.params.username;
  const newPassword = req.body.newPassword;

  const success = await admin.updateKasirPassword(username, newPassword);
  if (success) {
    res.redirect('/dataUser'); // Redirect ke halaman sukses reset password
  } else {
    res.status(500).send('Gagal mengatur ulang password pengguna.');
  }
});

// Rute untuk halaman update berdasarkan username  
app.get('/dataUser/update/:username', async (req, res) => {
  const username = req.params.username;
  console.log('Mengakses halaman updateUser.ejs dengan username:', username);

  const user = await admin.findUserByUsername(username);
  if (!user) {
    console.log('Pengguna tidak ditemukan.');
    res.status(404).send('User not found');
    return;
  }

  console.log('Data pengguna yang ditemukan:', user);
  res.render('updateUser', { user: user, title: 'Update user page' });
});


// Rute untuk melakukan update user
app.post('/update-user/:username', async (req, res) => {
  const username = req.params.username;
  const updatedUser = req.body;

  // Tambahkan pernyataan console.log() untuk melacak aliran eksekusi
  console.log('Mengirim permintaan pembaruan pengguna...');
  console.log('Username yang diperbarui:', username);
  console.log('Data yang diperbarui:', updatedUser);

  const result = await admin.updateUser(username, updatedUser);
  // Tambahkan pernyataan console.log() untuk melacak hasil dari pembaruan
  console.log('Hasil pembaruan:', result);

  if (result) {
    res.redirect('/dataUser'); // Redirect ke halaman sukses update user
  } else {
    res.status(404).send('Update failed.');
  }
});
  



// Rute untuk menampilkan semua data buku
app.get('/buku',  kasir.checkRole('kasir'), async (req, res) => {
  const books = await kasir.loadBook();
  console.log(books)
  res.render('buku', { 
    title:`Book page`,
    cont : books,  updateSuccess: false
  });
});


// Rute untuk mengambil informasi buku berdasarkan kode buku
app.get('/getBookInfo/:kodeBuku', async (req, res) => {
  const kodeBuku = req.params.kodeBuku;

  try {
    const bookInfo = await kasir.getBookInfo(kodeBuku);
    res.json(bookInfo);
  } catch (error) {
    console.error('Terjadi kesalahan dalam mengambil informasi buku:', error);
    res.status(500).json({ error: 'Terjadi kesalahan dalam mengambil informasi buku' });
  }
});


// Rute untuk menampilkan halaman utama kasir
app.get('/transaksi', admin.checkRole('kasir'), async (req, res) => {
    if (req.session.isLoggedIn && !req.session.isAdmin) {
      try {
        // Generate kode transaksi baru
        const kodeTransaksi = await kasir.generateKodeTransaksi();
        console.log('Kode Transaksi:', kodeTransaksi);

        const total = kasir.hitungTotal();
        
        // Tampilkan halaman penjualan dengan data kode transaksi dan keranjang
        res.render('transaksi', { kodeTransaksi, keranjang: kasir.keranjang, total, title: 'Transaksi Page' });
      } catch (error) {
        console.error('Error saat menampilkan halaman penjualan:', error);
        res.status(500).json({ error: 'Terjadi kesalahan saat menampilkan halaman penjualan' });
      }
  } else {
    res.redirect('/');
  }
});

// Route untuk menambahkan transaksi ke keranjang
app.post('/transaksi/add', async (req, res) => {
  const { kodeTransaksi, kodeBuku, jmlBeli, namaPelanggan } = req.body;

  if (!kodeBuku) {
    return res.status(400).json({ error: "Kode buku tidak valid." });
  }

  try {
    await kasir.tambahTransaksi(kodeTransaksi, kodeBuku, jmlBeli, namaPelanggan);
    res.redirect('/transaksi');
  } catch (error) {
    console.error('Terjadi kesalahan saat menambah transaksi:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat menambah transaksi' });
  }
});

// Rute untuk reset keranjang
app.post('/reset-keranjang', async (req, res) => {
  await kasir.resetKeranjang();
  res.redirect('/transaksi');
});

//Rute untuk pembayaran
app.post('/transaksi/bayar', async (req, res) => {
  const { totalPembelian, jumlahPembayaran, kodeTransaksi, kodeBuku, judul, jumlahBeli, hrgPokok, hrgJual } = req.body;

  try {
    // Panggil fungsi prosesPembayaran
    const kembalian = await kasir.prosesPembayaran( kodeTransaksi, jumlahPembayaran);
    
    res.redirect('/transaksi');
  } catch (error) {
    console.error('Terjadi kesalahan dalam proses pembayaran:', error);
    res.status(500).json({ error: 'Terjadi kesalahan dalam proses pembayaran' });
  }
});

//Rute untuk menyimpan transaksi
app.post('/transaksi/simpan', async (req, res) => {
  try {
    // Generate kode transaksi baru
    const kodeTransaksi = await kasir.generateKodeTransaksi();
    console.log('Kode Transaksi:', kodeTransaksi);

    // Simpan data transaksi utama ke dalam tabel transaksi
    await kasir.simpanTransaksiUtama(kodeTransaksi, kasir.hitungTotal(), kasir.totalBayar, kasir.kembalian);

    // Loop melalui keranjang dan simpan detail transaksi untuk setiap item dalam keranjang
    for (const item of kasir.keranjang) {
      const { kodeBuku, judul, jumlahBeli, namaPelanggan, hrgPokok, hrgJual } = item;
      await kasir.simpanDetailTransaksi(kodeTransaksi, namaPelanggan, kodeBuku, judul, jumlahBeli, hrgPokok, hrgJual);

      // Update stok buku
      await admin.updateStokBuku(kodeBuku, jumlahBeli);
    }

    // Hapus keranjang setelah transaksi selesai
    kasir.keranjang.length = 0;

    // Render halaman transaksi dan kirimkan pesan sukses
    const kodeTransaksiBaru = await kasir.generateKodeTransaksi();
    res.render('transaksi', { kodeTransaksi: kodeTransaksiBaru, keranjang: kasir.keranjang, total: kasir.hitungTotal(), message: 'Data transaksi berhasil disimpan.', title: 'Transaksi Page' });
  } catch (error) {
    console.error('Terjadi kesalahan dalam menyimpan data transaksi:', error);
    res.status(500).json({ error: 'Terjadi kesalahan dalam menyimpan data transaksi' });
  }
});

// Rute menampilkan riwayat transaksi
app.get('/riwayatTransaksi', admin.checkLoggedIn, async (req, res) => {
  try {
    const transaksiData = await admin.riwayatTransaksi();

        // Mengonversi tgl_transaksi menjadi objek Date jika diperlukan
        transaksiData.forEach((item) => {
          item.tgl_transaksi = new Date(item.tgl_transaksi);
        });
            // Menggunakan map untuk menambahkan properti 'items' jika belum ada
    transaksiData.forEach((item) => {
      if (!item.items) {
        item.items = [];
      }
    });

     // Memanggil fungsi updateRiwayatTransaksi untuk setiap entri transaksi
     for (const transaksi of transaksiData) {
      await admin.updateRiwayatTransaksi(transaksi.kode_buku, { judul: transaksi.judul });
    }

    res.render('riwayatTransaksi', { riwayatTransaksi: transaksiData,  title: 'Riwayat Transaksi Page'  });
  } catch (error) {
    console.error('Error fetching riwayatTransaksi :', error);
    res.status(500).send('Internal Server Error');
  }
});


// Fungsi untuk mencari riwayat transaksi berdasarkan kurun waktu
app.get('/riwayatTransaksi/cari', async (req, res) => {
  try {
      const startDate = new Date(req.query.startDate);
      const endDate = new Date(req.query.endDate);

      // Atur komponen waktu dari endDate menjadi akhir hari
      endDate.setHours(23, 59, 59, 999);

      console.log('Menerima permintaan untuk rentang tanggal:', startDate, 'sampai', endDate);

      const historyData = await admin.cariRiwayatTransaksi(startDate, endDate);
      
      // Kirim data ke halaman riwayatTransaksi.ejs
    res.render('riwayatTransaksi', { riwayatTransaksi: historyData, title: 'Riwayat Transaksi Page' });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).send('Internal Server Error');
  }
});







app.use('/', (req, res)=>{
  res.status(404)
  res.send('page not found :404')
});
app.listen(port, () =>{
  console.log(`Example app listening on port ${port}`)
});

// admin.fetchAndProcessTransactions();

// hashPasswords();
// Menggunakan app.use untuk penanganan 404


