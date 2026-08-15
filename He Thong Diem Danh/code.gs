/**
 * ============================================================================
 * WEBAPP ĐIỂM DANH HỌC SINH - PHẦN XỬ LÝ GOOGLE APPS SCRIPT
 * ============================================================================
 * HƯỚNG DẪN NHANH KHI MỞ LẠI SAU MỘT NĂM
 *
 * 1. File INFO là nơi quản lý danh sách lớp của toàn WebApp.
 *    Sheet phải có tên INFO, cột tên lớp là LOP, cột ID/link là ID_LINK.
 *
 * 2. Mỗi lớp có một file Google Sheets riêng, gồm các sheet:
 *    DanhSachGV, DanhSachMH, DanhSachHS và các sheet Tháng 1, Tháng 2...
 *
 * 3. Khi sang năm học mới:
 *    - Cập nhật LOP và ID_LINK trong sheet INFO.
 *    - Nếu tạo file INFO mới, thay INFO_SPREADSHEET_ID ngay bên dưới.
 *    - Không cần khai báo từng lớp trong Code.gs.
 *    - Có thể đổi tên file/thư mục Drive vì chương trình mở file bằng ID.
 *
 * 4. Quy ước: Có mặt = ô trống; vắng = V; có phép = P; sáng = S; chiều = C.
 *
 * 5. Sau khi sửa: Lưu -> chạy testClassFiles() -> triển khai phiên bản WebApp mới.
 *
 * Không đổi tên các hàm Index.html đang gọi: getAppConfig, getClassData,
 * saveAttendance, getAbsenceStats, getFaceRegistrationData,
 * saveFaceRegistration và getStudentPhoto.
 * ============================================================================
 */

/**
 * File trung tâm chứa danh sách lớp.
 * Sheet INFO cần có hai cột: LOP và ID_LINK.
 * ID_LINK có thể là ID thuần hoặc toàn bộ đường dẫn Google Sheets.
 */
const INFO_SPREADSHEET_ID = '1ShyCyo6lvoGKnz0D_45RSxXiOsZOc_eEda1iuHIN7fM';
const INFO_SHEET_NAME = 'INFO';

/**
 * Đọc động danh sách lớp từ file INFO, không còn khai báo lớp cố định trong code.
 * Các dòng tổng hợp như "25D3A + 25D3B" không phải ID Google Sheets nên tự bỏ qua.
 */
function getClassFiles_() {
  const infoSpreadsheet = SpreadsheetApp.openById(INFO_SPREADSHEET_ID);
  const infoSheet = infoSpreadsheet.getSheetByName(INFO_SHEET_NAME);
  if (!infoSheet) {
    throw new Error('File INFO không có sheet "' + INFO_SHEET_NAME + '".');
  }

  const values = infoSheet.getDataRange().getDisplayValues();
  if (!values.length) return {};

  const headers = values[0].map(normalizeHeader_);
  const classColumn = findHeaderColumn_(headers, ['lop', 'tenlop', 'class']);
  const linkColumn = findHeaderColumn_(headers, [
    'idlink', 'idfile', 'fileid', 'linkfile', 'link', 'url'
  ]);

  if (classColumn === -1) throw new Error('Sheet INFO không có cột LOP.');
  if (linkColumn === -1) throw new Error('Sheet INFO không có cột ID_LINK.');

  const classFiles = {};
  for (let row = 1; row < values.length; row++) {
    const className = String(values[row][classColumn] || '').trim();
    const spreadsheetId = extractSpreadsheetId_(values[row][linkColumn]);
    if (!className || !spreadsheetId) continue;
    if (classFiles[className]) {
      throw new Error('Lớp "' + className + '" bị lặp trong sheet INFO.');
    }
    classFiles[className] = spreadsheetId;
  }
  return classFiles;
}

function extractSpreadsheetId_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const urlMatch = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{25,})/);
  if (urlMatch) return urlMatch[1];
  return /^[a-zA-Z0-9_-]{25,}$/.test(text) ? text : '';
}

/** Tách ID thư mục Drive từ đường dẫn đầy đủ hoặc từ ID thuần. */
function extractDriveFolderId_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const urlMatch = text.match(/\/folders\/([a-zA-Z0-9_-]{20,})/);
  if (urlMatch) return urlMatch[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(text) ? text : '';
}

/** Tách ID file Drive từ link hoặc ID thuần. */
function extractDriveFileId_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const pathMatch = text.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (pathMatch) return pathMatch[1];
  const queryMatch = text.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (queryMatch) return queryMatch[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(text) ? text : '';
}

/** Đọc ID_IMG của một lớp trong sheet INFO. */
function getClassImageFolderId_(className) {
  const cleanClassName = String(className || '').trim();
  const infoSpreadsheet = SpreadsheetApp.openById(INFO_SPREADSHEET_ID);
  const infoSheet = infoSpreadsheet.getSheetByName(INFO_SHEET_NAME);
  if (!infoSheet) throw new Error('File INFO không có sheet "' + INFO_SHEET_NAME + '".');

  const values = infoSheet.getDataRange().getDisplayValues();
  if (!values.length) throw new Error('Sheet INFO đang trống.');
  const headers = values[0].map(normalizeHeader_);
  const classColumn = findHeaderColumn_(headers, ['lop', 'tenlop', 'class']);
  const imageColumn = findHeaderColumn_(headers, ['idimg', 'idimage', 'linkanh', 'folderanh']);
  if (classColumn === -1) throw new Error('Sheet INFO không có cột LOP.');
  if (imageColumn === -1) throw new Error('Sheet INFO không có cột ID_IMG.');

  for (let row = 1; row < values.length; row++) {
    if (String(values[row][classColumn] || '').trim() !== cleanClassName) continue;
    const folderId = extractDriveFolderId_(values[row][imageColumn]);
    if (!folderId) throw new Error('Lớp ' + cleanClassName + ' chưa có ID_IMG hợp lệ.');
    return folderId;
  }
  throw new Error('Không tìm thấy lớp ' + cleanClassName + ' trong sheet INFO.');
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Điểm danh học sinh')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Chạy thủ công khi cài đặt hoặc đầu năm học để cấp quyền và kiểm tra các file.
 * Kết quả được ghi trong Nhật ký thực thi.
 */
function testClassFiles() {
  const result = [];
  const classFiles = getClassFiles_();

  Object.keys(classFiles).forEach(function(className) {
    try {
      const ss = SpreadsheetApp.openById(classFiles[className]);
      const sheetNames = ss.getSheets().map(function(sheet) {
        return sheet.getName();
      });

      const requiredSheets = ['DanhSachGV', 'DanhSachMH', 'DanhSachHS'];
      const missingSheets = requiredSheets.filter(function(sheetName) {
        return sheetNames.indexOf(sheetName) === -1;
      });

      result.push({
        className: className,
        spreadsheetName: ss.getName(),
        status: missingSheets.length ? 'THIẾU SHEET' : 'OK',
        missingSheets: missingSheets
      });
    } catch (error) {
      result.push({
        className: className,
        status: 'KHÔNG MỞ ĐƯỢC',
        error: error.message
      });
    }
  });

  console.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Chạy thủ công một lần sau khi bổ sung ID_IMG để cấp quyền Drive
 * và kiểm tra WebApp có mở được thư mục HinhAnhHS hay không.
 */
function testFaceStorage() {
  const classFiles = getClassFiles_();
  const result = Object.keys(classFiles).map(function(className) {
    try {
      const folderId = getClassImageFolderId_(className);
      const folder = DriveApp.getFolderById(folderId);
      return { className: className, status: 'OK', folderName: folder.getName(), folderId: folderId };
    } catch (error) {
      return { className: className, status: 'LỖI', error: error.message };
    }
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Trả danh sách lớp và danh sách giáo viên dùng chung cho màn hình ban đầu.
 * Lớp và môn học vẫn để người dùng tự chọn trong mỗi lần mở ứng dụng.
 */
function getAppConfig() {
  const teachers = [];
  const classFiles = getClassFiles_();

  Object.keys(classFiles).forEach(function(className) {
    const ss = SpreadsheetApp.openById(classFiles[className]);
    getSimpleList_(ss, 'DanhSachGV', [
      'hovaten', 'hoten', 'tengv', 'hotengv', 'giaovien'
    ]).forEach(function(teacher) {
      if (teachers.indexOf(teacher) === -1) teachers.push(teacher);
    });
  });

  return {
    classes: Object.keys(classFiles),
    teachers: teachers
  };
}

/** Mở đúng file của lớp; không dùng getActiveSpreadsheet() vì đây là WebApp. */
function openClassSpreadsheet(className) {
  const cleanClassName = String(className || '').trim();
  const spreadsheetId = getClassFiles_()[cleanClassName];
  if (!spreadsheetId) {
    throw new Error('Lớp không hợp lệ hoặc chưa được cấu hình: ' + cleanClassName);
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

/** Tải môn học, chi tiết môn học và học sinh của lớp đã chọn. */
function getClassData(className) {
  const cleanClassName = String(className || '').trim();
  const ss = openClassSpreadsheet(cleanClassName);
  return {
    className: cleanClassName,
    subjects: getSimpleList_(ss, 'DanhSachMH', [
      'tenmh', 'tenmon', 'monhoc', 'tenmonhoc', 'mh', 'mohoc'
    ]),
    subjectDetails: getSubjectDetails_(ss, 'DanhSachMH'),
    students: getStudentList_(ss, cleanClassName)
  };
}

/**
 * Tải danh sách phục vụ màn hình Cài đặt -> Quản lý khuôn mặt.
 * Không gửi các vector xuống ở bước này để danh sách tải nhanh và nhẹ.
 */
function getFaceRegistrationData(className) {
  const cleanClassName = String(className || '').trim();
  const ss = openClassSpreadsheet(cleanClassName);
  const sheet = requireSheet_(ss, 'DanhSachHS');
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return { className: cleanClassName, students: [] };

  const headers = values[0].map(normalizeHeader_);
  const columns = {
    STT: findHeaderColumn_(headers, ['stt', 'tt']),
    MSSV: findHeaderColumn_(headers, ['mssv', 'mahs', 'mahocsinh']),
    HoVaTen: findHeaderColumn_(headers, ['hovaten', 'hoten', 'tenhocsinh']),
    LinkAnh: findHeaderColumn_(headers, ['linkanh', 'anh', 'anhhocsinh']),
    Vector1: findHeaderColumn_(headers, ['vector1']),
    Vector2: findHeaderColumn_(headers, ['vector2']),
    Vector3: findHeaderColumn_(headers, ['vector3']),
    Vector4: findHeaderColumn_(headers, ['vector4']),
    Vector5: findHeaderColumn_(headers, ['vector5']),
    NgayCapNhat: findHeaderColumn_(headers, ['ngaycapnhat']),
    TrangThai: findHeaderColumn_(headers, ['trangthai'])
  };
  assertFaceColumns_(columns);

  const students = [];
  for (let row = 1; row < values.length; row++) {
    const name = cell_(values[row], columns.HoVaTen);
    if (!name) continue;
    const vectorCount = [1, 2, 3, 4, 5].filter(function(number) {
      return !!cell_(values[row], columns['Vector' + number]);
    }).length;
    const savedStatus = cell_(values[row], columns.TrangThai);
    students.push({
      STT: cell_(values[row], columns.STT),
      MSSV: cell_(values[row], columns.MSSV),
      HoVaTen: name,
      LinkAnh: cell_(values[row], columns.LinkAnh),
      NgayCapNhat: cell_(values[row], columns.NgayCapNhat),
      TrangThai: savedStatus || (vectorCount === 5 ? 'Đã đăng ký' : 'Chưa đăng ký'),
      VectorCount: vectorCount
    });
  }
  students.sort(function(a, b) {
    return Number(a.STT) - Number(b.STT);
  });
  return { className: cleanClassName, students: students };
}

/** Kiểm tra đủ các cột A:V cần cho chức năng đăng ký khuôn mặt. */
function assertFaceColumns_(columns) {
  const required = [
    'STT', 'HoVaTen', 'LinkAnh', 'Vector1', 'Vector2', 'Vector3',
    'Vector4', 'Vector5', 'NgayCapNhat', 'TrangThai'
  ];
  const missing = required.filter(function(name) { return columns[name] === -1; });
  if (missing.length) {
    throw new Error('DanhSachHS đang thiếu cột: ' + missing.join(', ') + '.');
  }
}

/**
 * Lưu một lần đăng ký khuôn mặt hoàn chỉnh:
 * - Ảnh nhìn thẳng vào Drive/HinhAnhHS/<Tên lớp>
 * - Vector1..Vector5, NgayCapNhat, TrangThai vào đúng dòng DanhSachHS
 */
function saveFaceRegistration(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Dữ liệu đăng ký không hợp lệ.');
  const className = String(payload.className || '').trim();
  const studentName = String(payload.studentName || '').trim();
  const studentSTT = String(payload.studentSTT == null ? '' : payload.studentSTT).trim();
  if (!className || !studentName) throw new Error('Chưa xác định lớp hoặc học sinh.');

  const vectors = Array.isArray(payload.vectors) ? payload.vectors : [];
  if (vectors.length !== 5) throw new Error('Phải có đủ 5 mẫu khuôn mặt.');
  vectors.forEach(function(vector, index) {
    if (!Array.isArray(vector) || vector.length !== 128) {
      throw new Error('Vector' + (index + 1) + ' không đủ 128 giá trị.');
    }
    vector.forEach(function(value) {
      if (typeof value !== 'number' || !isFinite(value)) {
        throw new Error('Dữ liệu vector khuôn mặt không hợp lệ.');
      }
    });
  });

  const imageMatch = String(payload.portraitDataUrl || '').match(/^data:image\/(jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/i);
  if (!imageMatch) throw new Error('Ảnh đại diện không hợp lệ.');
  const imageBytes = Utilities.base64Decode(imageMatch[2]);
  if (imageBytes.length > 3 * 1024 * 1024) throw new Error('Ảnh đại diện vượt quá 3 MB.');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let newFile = null;
  try {
    const ss = openClassSpreadsheet(className);
    const sheet = requireSheet_(ss, 'DanhSachHS');
    const values = sheet.getDataRange().getDisplayValues();
    const headers = values[0].map(normalizeHeader_);
    const columns = {
      STT: findHeaderColumn_(headers, ['stt', 'tt']),
      HoVaTen: findHeaderColumn_(headers, ['hovaten', 'hoten', 'tenhocsinh']),
      LinkAnh: findHeaderColumn_(headers, ['linkanh', 'anh', 'anhhocsinh']),
      Vector1: findHeaderColumn_(headers, ['vector1']),
      Vector2: findHeaderColumn_(headers, ['vector2']),
      Vector3: findHeaderColumn_(headers, ['vector3']),
      Vector4: findHeaderColumn_(headers, ['vector4']),
      Vector5: findHeaderColumn_(headers, ['vector5']),
      NgayCapNhat: findHeaderColumn_(headers, ['ngaycapnhat']),
      TrangThai: findHeaderColumn_(headers, ['trangthai'])
    };
    assertFaceColumns_(columns);
    const studentRow = findStudentDataRow_(values, studentSTT, studentName, columns.STT, columns.HoVaTen);

    const rootFolder = DriveApp.getFolderById(getClassImageFolderId_(className));
    const classFolders = rootFolder.getFoldersByName(className);
    const classFolder = classFolders.hasNext() ? classFolders.next() : rootFolder.createFolder(className);
    const safeName = normalizeFileName_(studentName);
    const fileName = 'STT_' + String(studentSTT || studentRow - 1).padStart(2, '0') + '_' + safeName + '.jpg';
    const blob = Utilities.newBlob(imageBytes, 'image/jpeg', fileName);
    newFile = classFolder.createFile(blob);

    const oldImageId = extractDriveFileId_(values[studentRow - 1][columns.LinkAnh]);
    const now = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone() || 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss');
    sheet.getRange(studentRow, columns.LinkAnh + 1).setValue(newFile.getUrl());
    for (let index = 0; index < 5; index++) {
      sheet.getRange(studentRow, columns['Vector' + (index + 1)] + 1)
        .setValue(JSON.stringify(vectors[index]));
    }
    sheet.getRange(studentRow, columns.NgayCapNhat + 1).setValue(now);
    sheet.getRange(studentRow, columns.TrangThai + 1).setValue('Đã đăng ký');
    SpreadsheetApp.flush();

    if (oldImageId && oldImageId !== newFile.getId()) {
      try { DriveApp.getFileById(oldImageId).setTrashed(true); } catch (ignored) {}
    }
    return {
      ok: true,
      className: className,
      studentSTT: studentSTT,
      studentName: studentName,
      updatedAt: now,
      status: 'Đã đăng ký',
      imageFileId: newFile.getId()
    };
  } catch (error) {
    if (newFile) {
      try { newFile.setTrashed(true); } catch (ignored) {}
    }
    throw error;
  } finally {
    lock.releaseLock();
  }
}

/** Trả ảnh riêng tư dưới dạng data URL để giao diện hiển thị mà không công khai Drive. */
function getStudentPhoto(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Yêu cầu ảnh không hợp lệ.');
  const className = String(payload.className || '').trim();
  const ss = openClassSpreadsheet(className);
  const sheet = requireSheet_(ss, 'DanhSachHS');
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map(normalizeHeader_);
  const sttColumn = findHeaderColumn_(headers, ['stt', 'tt']);
  const nameColumn = findHeaderColumn_(headers, ['hovaten', 'hoten', 'tenhocsinh']);
  const imageColumn = findHeaderColumn_(headers, ['linkanh', 'anh', 'anhhocsinh']);
  if (imageColumn === -1) throw new Error('DanhSachHS không có cột LinkAnh.');
  const row = findStudentDataRow_(values, payload.studentSTT, payload.studentName, sttColumn, nameColumn);
  const fileId = extractDriveFileId_(values[row - 1][imageColumn]);
  if (!fileId) return { found: false };
  const blob = DriveApp.getFileById(fileId).getBlob();
  return {
    found: true,
    dataUrl: 'data:' + (blob.getContentType() || 'image/jpeg') + ';base64,' +
      Utilities.base64Encode(blob.getBytes())
  };
}

function findStudentDataRow_(values, studentSTT, studentName, sttColumn, nameColumn) {
  const wantedSTT = String(studentSTT == null ? '' : studentSTT).trim();
  const wantedName = normalizeVietnameseText_(studentName);
  for (let row = 1; row < values.length; row++) {
    const rowSTT = sttColumn === -1 ? '' : String(values[row][sttColumn] || '').trim();
    const rowName = nameColumn === -1 ? '' : normalizeVietnameseText_(values[row][nameColumn]);
    if (wantedSTT && rowSTT && Number(wantedSTT) === Number(rowSTT) && (!wantedName || rowName === wantedName)) {
      return row + 1;
    }
  }
  throw new Error('Không tìm thấy học sinh ' + (studentName || studentSTT) + ' trong DanhSachHS.');
}

function normalizeFileName_(value) {
  return normalizeVietnameseText_(value).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'hoc_sinh';
}

/**
 * Ghi điểm danh vào sheet tháng của đúng lớp.
 * status: PRESENT | ABSENT | EXCUSED
 * session: S | C
 * attendanceDate: yyyy-MM-dd, kể cả ngày điểm danh bù.
 */
function saveAttendance(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Dữ liệu điểm danh không hợp lệ.');
  }

  const className = String(payload.className || '').trim();
  const session = String(payload.session || '').trim().toUpperCase();
  const status = String(payload.status || '').trim().toUpperCase();
  const dateText = String(payload.attendanceDate || '').trim();

  if (!getClassFiles_()[className]) throw new Error('Chưa chọn lớp hợp lệ.');
  if (session !== 'S' && session !== 'C') throw new Error('Buổi điểm danh phải là S hoặc C.');
  if (['PRESENT', 'ABSENT', 'EXCUSED'].indexOf(status) === -1) {
    throw new Error('Trạng thái điểm danh không hợp lệ.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw new Error('Ngày điểm danh không hợp lệ.');
  }

  const parts = dateText.split('-').map(Number);
  const targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
  if (
    targetDate.getFullYear() !== parts[0] ||
    targetDate.getMonth() !== parts[1] - 1 ||
    targetDate.getDate() !== parts[2]
  ) {
    throw new Error('Ngày điểm danh không tồn tại.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const ss = openClassSpreadsheet(className);
    const sheet = findMonthSheet_(ss, parts[1]);
    const range = sheet.getDataRange();
    const raw = range.getValues();
    const display = range.getDisplayValues();

    const attendanceCell = findAttendanceColumn_(raw, display, targetDate, session);
    const studentRow = findMonthlyStudentRow_(
      display,
      payload.studentSTT,
      payload.studentName
    );

    const mark = status === 'ABSENT' ? 'V' : status === 'EXCUSED' ? 'P' : '';
    sheet.getRange(studentRow, attendanceCell.column).setValue(mark);

    writeHeaderValueIfPresent_(sheet, display, attendanceCell.column, [
      'gv', 'giaovien', 'gvgiangday'
    ], payload.teacher);
    writeHeaderValueIfPresent_(sheet, display, attendanceCell.column, [
      'mhmd', 'monhoc', 'mh', 'mohoc'
    ], payload.subject);

    SpreadsheetApp.flush();

    const today = new Date();
    const isMakeup = !sameDate_(today, targetDate);
    return {
      ok: true,
      className: className,
      sheetName: sheet.getName(),
      cell: sheet.getRange(studentRow, attendanceCell.column).getA1Notation(),
      mark: mark,
      session: session,
      attendanceDate: dateText,
      isMakeup: isMakeup
    };
  } finally {
    lock.releaseLock();
  }
}

/** Thống kê V/P của một học sinh trong tháng, chỉ theo môn đang chọn. */
function getAbsenceStats(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Dữ liệu thống kê không hợp lệ.');

  const className = String(payload.className || '').trim();
  const subject = String(payload.subject || '').trim();
  const dateText = String(payload.attendanceDate || '').trim();
  if (!getClassFiles_()[className]) throw new Error('Chưa chọn lớp hợp lệ.');
  if (!subject) throw new Error('Chưa chọn môn học.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) throw new Error('Ngày thống kê không hợp lệ.');

  const parts = dateText.split('-').map(Number);
  const ss = openClassSpreadsheet(className);
  const sheet = findMonthSheet_(ss, parts[1]);
  const display = sheet.getDataRange().getDisplayValues();
  const studentRow = findMonthlyStudentRow_(display, payload.studentSTT, payload.studentName);
  const subjectRow = findHeaderLabelRow_(display, ['mhmd', 'monhoc', 'mh', 'mohoc']);
  const wantedSubject = normalizeVietnameseText_(subject);
  let excused = 0;
  let absent = 0;

  for (let column = 3; column < display[0].length; column++) {
    const columnSubject = normalizeVietnameseText_(display[subjectRow - 1][column]);
    if (columnSubject !== wantedSubject) continue;
    const mark = String(display[studentRow - 1][column] || '').trim().toUpperCase();
    if (mark === 'P') excused++;
    if (mark === 'V') absent++;
  }

  return {
    className: className,
    sheetName: sheet.getName(),
    month: parts[1],
    subject: subject,
    excused: excused,
    absent: absent
  };
}

function findHeaderLabelRow_(display, possibleLabels) {
  const maxRows = Math.min(10, display.length);
  const maxColumns = Math.min(6, display[0] ? display[0].length : 0);
  for (let row = 0; row < maxRows; row++) {
    for (let column = 0; column < maxColumns; column++) {
      if (possibleLabels.indexOf(normalizeHeader_(display[row][column])) !== -1) return row + 1;
    }
  }
  throw new Error('Không tìm thấy dòng Môn học trong sheet ' + (display.length ? 'tháng.' : 'tháng'));
}

function findMonthSheet_(ss, month) {
  const wanted = 'thang' + month;
  const sheet = ss.getSheets().find(function(item) {
    return normalizeHeader_(item.getName()) === wanted;
  });
  if (!sheet) throw new Error('Không tìm thấy sheet Tháng ' + month + ' trong file ' + ss.getName() + '.');
  return sheet;
}

function findAttendanceColumn_(raw, display, targetDate, session) {
  const maxHeaderRows = Math.min(10, display.length);
  const maxColumns = display[0] ? display[0].length : 0;
  const day = targetDate.getDate();

  for (let row = 0; row < maxHeaderRows; row++) {
    for (let column = 0; column < maxColumns; column++) {
      if (!headerDateMatches_(raw[row][column], display[row][column], targetDate, day)) continue;

      // Một ô ngày thường phủ hai cột: S ở cột hiện tại, C ở cột kế bên.
      for (let candidateColumn = column; candidateColumn <= Math.min(column + 2, maxColumns - 1); candidateColumn++) {
        for (let candidateRow = Math.max(0, row - 2); candidateRow <= Math.min(maxHeaderRows - 1, row + 4); candidateRow++) {
          const value = normalizeSession_(display[candidateRow][candidateColumn]);
          if (value === session) {
            return { column: candidateColumn + 1, sessionRow: candidateRow + 1 };
          }
        }
      }
    }
  }

  throw new Error(
    'Không tìm thấy cột ngày ' + Utilities.formatDate(targetDate, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy') +
    ', buổi ' + session + ' trong sheet tháng.'
  );
}

/** Kiểm tra một ô tiêu đề có đúng ngày cần điểm danh hay không. */
function headerDateMatches_(rawValue, displayValue, targetDate, day) {
  if (Object.prototype.toString.call(rawValue) === '[object Date]' && !isNaN(rawValue.getTime())) {
    return sameDate_(rawValue, targetDate);
  }
  const text = String(displayValue || '').trim();
  if (!text) return false;
  if (/^\d{1,2}$/.test(text)) return Number(text) === day;
  const match = text.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/);
  if (!match) return false;
  if (Number(match[1]) !== day || Number(match[2]) !== targetDate.getMonth() + 1) return false;
  if (!match[3]) return true;
  const year = Number(match[3].length === 2 ? '20' + match[3] : match[3]);
  return year === targetDate.getFullYear();
}

/** Chuẩn hóa các cách ghi Sáng/Chiều trong sheet thành S hoặc C. */
function normalizeSession_(value) {
  const normalized = normalizeHeader_(value);
  if (normalized === 's' || normalized === 'sang' || normalized === 'buoisang') return 'S';
  if (normalized === 'c' || normalized === 'chieu' || normalized === 'buoichieu') return 'C';
  return '';
}

/** Tìm dòng học sinh trong sheet tháng, ưu tiên STT rồi mới so tên. */
function findMonthlyStudentRow_(display, studentSTT, studentName) {
  const wantedSTT = String(studentSTT == null ? '' : studentSTT).trim();
  const wantedName = normalizeVietnameseText_(studentName);

  for (let row = 7; row < display.length; row++) {
    const rowSTT = String(display[row][0] || '').trim();
    const rowName = normalizeVietnameseText_(display[row][1]);
    if (wantedSTT && rowSTT && Number(rowSTT) === Number(wantedSTT)) return row + 1;
    if (wantedName && rowName === wantedName) return row + 1;
  }
  throw new Error('Không tìm thấy học sinh ' + (studentName || studentSTT) + ' trong sheet tháng.');
}

/** Ghi giáo viên hoặc môn học vào dòng tiêu đề nếu sheet có nhãn tương ứng. */
function writeHeaderValueIfPresent_(sheet, display, targetColumn, possibleLabels, value) {
  const cleanValue = String(value || '').trim();
  if (!cleanValue) return;
  const maxRows = Math.min(10, display.length);
  const maxColumns = Math.min(5, display[0] ? display[0].length : 0);
  for (let row = 0; row < maxRows; row++) {
    for (let column = 0; column < maxColumns; column++) {
      if (possibleLabels.indexOf(normalizeHeader_(display[row][column])) !== -1) {
        sheet.getRange(row + 1, targetColumn).setValue(cleanValue);
        return;
      }
    }
  }
}

function sameDate_(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function normalizeVietnameseText_(value) {
  return String(value || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/\s+/g, ' ');
}

/** Đọc danh sách một cột, ví dụ danh sách giáo viên hoặc môn học. */
function getSimpleList_(ss, sheetName, possibleHeaders) {
  const sheet = requireSheet_(ss, sheetName);
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];

  const headers = values[0].map(normalizeHeader_);
  let column = findHeaderColumn_(headers, possibleHeaders);
  if (column === -1) column = 1; // Cấu trúc hiện tại dùng cột B.

  const result = [];
  for (let row = 1; row < values.length; row++) {
    const value = String(values[row][column] || '').trim();
    if (value) result.push(value);
  }
  return uniqueList_(result);
}


/**
 * Đọc thông tin chi tiết môn học từ sheet DanhSachMH.
 *
 * Các trường trả về:
 *   TenMH
 *   HocKy
 *   TongSoGio
 *   DanhSachMH
 *   ThucHanh
 *   Thi
 *
 * Hàm chỉ ĐỌC dữ liệu, không thay đổi sheet.
 */
function getSubjectDetails_(ss, sheetName) {
  const sheet = requireSheet_(ss, sheetName);
  const values = sheet.getDataRange().getDisplayValues();

  if (values.length < 2) {
    return [];
  }

  // Dòng đầu tiên là dòng tiêu đề của DanhSachMH.
  const headers = values[0].map(normalizeHeader_);

  function col(aliases) {
    return findHeaderColumn_(headers, aliases);
  }

  const columns = {
    TenMH: col([
      'tenmh',
      'tenmon',
      'monhoc',
      'tenmonhoc',
      'mh',
      'mohoc'
    ]),

    HocKy: col([
      'hocky',
      'hocki'
    ]),

    TongSoGio: col([
      'tongsogio',
      'tongsogiohoc',
      'sogio'
    ]),

    DanhSachMH: col([
      'lythuyet',
      'lythuyetgio',
      'danhsachmh',
      'mamh',
      'mamon',
      'mamonhoc'
    ]),

    ThucHanh: col([
      'thuchanh',
      'thuchanhgio',
      'giothuchanh'
    ]),

    Thi: col([
      'thi',
      'thigio',
      'giothi'
    ])
  };

  if (columns.TenMH === -1) {
    throw new Error(
      'Sheet DanhSachMH không có cột tên môn học.'
    );
  }

  const result = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const tenMH = cell_(row, columns.TenMH);

    // Bỏ qua dòng trống.
    if (!tenMH) {
      continue;
    }

    result.push({
      TenMH: tenMH,
      HocKy: cell_(row, columns.HocKy),
      TongSoGio: cell_(row, columns.TongSoGio),
      DanhSachMH: cell_(row, columns.DanhSachMH),
      ThucHanh: cell_(row, columns.ThucHanh),
      Thi: cell_(row, columns.Thi)
    });
  }

  return result;
}

function getStudentList_(ss, className) {
  const sheet = requireSheet_(ss, 'DanhSachHS');
  const range = sheet.getDataRange();
  const rawValues = range.getValues();
  const displayValues = range.getDisplayValues();
  if (displayValues.length < 2) return [];

  const headers = displayValues[0].map(normalizeHeader_);
  const columns = {
    STT: findHeaderColumn_(headers, ['stt', 'tt']),
    MSSV: findHeaderColumn_(headers, ['mssv', 'mahs', 'mahocsinh']),
    HoVaTen: findHeaderColumn_(headers, ['hovaten', 'hoten', 'tenhocsinh']),
    NgaySinh: findHeaderColumn_(headers, ['ngaysinh']),
    SDT_HS: findHeaderColumn_(headers, ['sdths', 'sdthocsinh']),
    CCCD: findHeaderColumn_(headers, ['cccd']),
    BHYT: findHeaderColumn_(headers, ['bhyt']),
    TenCha: findHeaderColumn_(headers, ['tencha', 'hotencha']),
    SDT_Cha: findHeaderColumn_(headers, ['sdtcha']),
    TenMe: findHeaderColumn_(headers, ['tenme', 'hotenme']),
    SDT_Me: findHeaderColumn_(headers, ['sdtme']),
    DiaChi: findHeaderColumn_(headers, ['diachi']),
    GhiChu: findHeaderColumn_(headers, ['ghichu']),
    LinkAnh: findHeaderColumn_(headers, ['linkanh', 'anh', 'anhhocsinh']),
    VectorKhuonMat: findHeaderColumn_(headers, ['vectorkhuonmat'])
  };

  if (columns.STT === -1) throw new Error('Sheet DanhSachHS không có cột STT.');
  if (columns.HoVaTen === -1) throw new Error('Sheet DanhSachHS không có cột HoVaTen.');

  const timezone = ss.getSpreadsheetTimeZone() || 'Asia/Ho_Chi_Minh';
  const students = [];
  for (let row = 1; row < displayValues.length; row++) {
    const name = cell_(displayValues[row], columns.HoVaTen);
    if (!name) continue;

    students.push({
      STT: cell_(displayValues[row], columns.STT),
      MSSV: cell_(displayValues[row], columns.MSSV),
      HoVaTen: name,
      Lop: className,
      NgaySinh: dateCell_(rawValues[row], displayValues[row], columns.NgaySinh, timezone),
      SDT_HS: cell_(displayValues[row], columns.SDT_HS),
      CCCD: cell_(displayValues[row], columns.CCCD),
      BHYT: cell_(displayValues[row], columns.BHYT),
      TenCha: cell_(displayValues[row], columns.TenCha),
      SDT_Cha: cell_(displayValues[row], columns.SDT_Cha),
      TenMe: cell_(displayValues[row], columns.TenMe),
      SDT_Me: cell_(displayValues[row], columns.SDT_Me),
      DiaChi: cell_(displayValues[row], columns.DiaChi),
      GhiChu: cell_(displayValues[row], columns.GhiChu),
      LinkAnh: cell_(displayValues[row], columns.LinkAnh),
      VectorKhuonMat: cell_(displayValues[row], columns.VectorKhuonMat)
    });
  }

  students.sort(function(a, b) {
    const aNumber = Number(a.STT);
    const bNumber = Number(b.STT);
    if (isFinite(aNumber) && isFinite(bNumber)) return aNumber - bNumber;
    return String(a.STT).localeCompare(String(b.STT), 'vi', { numeric: true });
  });
  return students;
}

/** Bắt buộc file phải có sheet cần dùng; nếu thiếu sẽ báo rõ tên sheet. */
function requireSheet_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('File "' + ss.getName() + '" không có sheet ' + sheetName + '.');
  return sheet;
}

/** Lấy nội dung ô an toàn; cột không tồn tại sẽ trả chuỗi trống. */
function cell_(row, column) {
  if (column === -1 || column === null || column === undefined) return '';
  return String(row[column] == null ? '' : row[column]).trim();
}

/** Định dạng ngày sinh thống nhất theo dd/MM/yyyy. */
function dateCell_(rawRow, displayRow, column, timezone) {
  if (column === -1) return '';
  const raw = rawRow[column];
  if (Object.prototype.toString.call(raw) === '[object Date]' && !isNaN(raw.getTime())) {
    return Utilities.formatDate(raw, timezone, 'dd/MM/yyyy');
  }
  return cell_(displayRow, column);
}

/** Chuẩn hóa tiêu đề: bỏ dấu, khoảng trắng, gạch dưới và phân biệt hoa/thường. */
function normalizeHeader_(value) {
  return String(value || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '');
}

function findHeaderColumn_(headers, possibleNames) {
  for (let i = 0; i < possibleNames.length; i++) {
    const index = headers.indexOf(possibleNames[i]);
    if (index !== -1) return index;
  }
  return -1;
}

function uniqueList_(values) {
  return values.filter(function(value, index) { return values.indexOf(value) === index; });
}
