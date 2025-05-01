
// // Configure multer for file uploads
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const uploadDir = path.join(__dirname, '../uploads');
    
//     // Create the directory if it doesn't exist
//     fs.mkdir(uploadDir, { recursive: true }, (err) => {
//       if (err) {
//         console.error('Error creating upload directory:', err);
//         return cb(err, uploadDir);
//       }
//       cb(null, uploadDir);
//     });
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
//   }
// });

// const upload = multer({
//   storage: storage,
//   limits: {
//     fileSize: 5 * 1024 * 1024, // 5MB limit
//   },
//   fileFilter: (req, file, cb) => {
//     // Add allowed file types
//     const allowedTypes = [
//       'image/jpeg', 
//       'image/png', 
//       'image/gif', 
//       'application/pdf',
//       'application/zip',
//       'application/x-zip-compressed' 
//     ];
    
//     console.log(`File upload attempt: ${file.originalname} (${file.mimetype})`);
    
//     if (allowedTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       console.log(`File type rejected: ${file.mimetype}`);
//       cb(new Error('Invalid file type'));
//     }
//   }
// });

// // Error handling middleware for multer
// const handleMulterError = (err: any, req: any, res: any, next: any) => {
//   if (err instanceof multer.MulterError) {
//     if (err.code === 'LIMIT_FILE_SIZE') {
//       return res.status(400).json({ error: 'File size is too large' });
//     }
//     return res.status(400).json({ error: err.message });
//   } else if (err) {
//     return res.status(500).json({ error: err.message });
//   }
//   next();
// };