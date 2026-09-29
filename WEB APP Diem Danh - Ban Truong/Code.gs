/**
 * ============================================================================
 * WEBAPP ĐIỂM DANH HỌC SINH - PHẦN XỬ LÝ GOOGLE APPS SCRIPT
 * ============================================================================
 * HƯỚNG DẪN NHANH KHI MỞ LẠI SAU MỘT NĂM
 *
 * 1. File INFO là nơi quản lý danh sách lớp của toàn WebApp.
 *    Sheet phải có tên INFO, cột tên lớp là LOP, cột link là ID_SHEET_LINK.
 *
 * 2. Mỗi lớp có một file Google Sheets riêng, gồm các sheet:
 *    DanhSachGV, DanhSachMH, DanhSachHS và các sheet Tháng 1, Tháng 2...
 *
 * 3. Khi sang năm học mới:
 *    - Cập nhật LOP và ID_SHEET_LINK trong sheet INFO.
 *    - Nếu tạo file INFO mới, thay INFO_SPREADSHEET_ID ngay bên dưới.
 *    - Không cần khai báo từng lớp trong Code.gs.
 *    - Có thể đổi tên file/thư mục Drive vì chương trình mở file bằng ID.
 *
 * 4. Quy ước: Có mặt = ô trống; vắng = V; có phép = P; sáng = S; chiều = C.
 *
 * 5. Sau khi sửa: Lưu -> chạy testClassFiles() -> triển khai phiên bản WebApp mới.
 *
 * Không đổi tên các hàm Index.html đang gọi: getAppConfig, getClassData,
 * getAvatarClassData, getStudentProfilePhotoData, getStudentProfilePhotosData,
 * saveStudentNote, prepareAttendanceSession, saveAttendance và getAbsenceStats.
 * ============================================================================
 */

/**
 * File trung tâm chứa danh sách lớp.
 * Sheet INFO cần có hai cột: LOP và ID_SHEET_LINK.
 * Nên dán toàn bộ đường dẫn Google Sheets vào ID_SHEET_LINK để dễ sao chép.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

const INFO_SPREADSHEET_ID = '1ShyCyo6lvoGKnz0D_45RSxXiOsZOc_eEda1iuHIN7fM';
const INFO_SHEET_NAME = 'INFO';
const SCHOOL_YEAR_FOLDER_ID = '1PX_JPHAiStmnjI0QkfVKKHY7eakLg4mm';
const STUDENT_IMAGE_FOLDER_NAME = 'HinhAnhHS';
const CLASS_FILES_CACHE_KEY = 'class_files_v4';
const CLASS_FILES_CACHE_SECONDS = 21600; // 6 giờ
const SUBJECT_START_DATE_COLUMN = 8; // H - NgayBatDau trong DanhSachMH
const SUBJECT_PROGRESS_COLUMN = 9;   // I - TienDo trong DanhSachMH
const HOURS_PER_SESSION = 4;
const ATTENDANCE_DATE_ROW = 5;
const ATTENDANCE_SESSION_ROW = 6;
const ATTENDANCE_TEACHER_ROW = 7;
const ATTENDANCE_SUBJECT_ROW = 8;
const ATTENDANCE_FIRST_STUDENT_ROW = 9;
const ATTENDANCE_FIRST_COLUMN = 5; // E; E-F là sáng-chiều, G-H là ngày kế tiếp.
const ACADEMIC_MONTH_ORDER = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7];
const ATTENDANCE_DATA_CACHE_SECONDS = 21600; // 6 giờ
const SUBJECT_DATA_CACHE_PREFIX = 'subject_data_v6_';
const TEACHER_DATA_CACHE_PREFIX = 'teacher_data_v1_';
const ATTENDANCE_SLOT_CACHE_PREFIX = 'attendance_slot_v4_';
const MONTH_STUDENT_CACHE_PREFIX = 'month_students_v3_';

/**
 * Đọc động danh sách lớp từ file INFO, không còn khai báo lớp cố định trong code.
 * Các dòng tổng hợp như "25D3A + 25D3B" không phải ID Google Sheets nên tự bỏ qua.
 */
function getClassFiles_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CLASS_FILES_CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      cache.remove(CLASS_FILES_CACHE_KEY);
    }
  }

  const infoSpreadsheet = SpreadsheetApp.openById(INFO_SPREADSHEET_ID);
  const infoSheet = infoSpreadsheet.getSheetByName(INFO_SHEET_NAME);
  if (!infoSheet) {
    throw new Error('File INFO không có sheet "' + INFO_SHEET_NAME + '".');
  }

  const lastRow = infoSheet.getLastRow();
  const lastColumn = infoSheet.getLastColumn();
  if (lastRow < 1 || lastColumn < 1) return {};

  const headers = infoSheet.getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(normalizeHeader_);
  const classColumn = findHeaderColumn_(headers, ['lop', 'tenlop', 'class']);
  const linkColumn = findHeaderColumn_(headers, ['idsheetlink']);

  if (classColumn === -1) throw new Error('Sheet INFO không có cột LOP.');
  if (linkColumn === -1) throw new Error('Sheet INFO không có cột ID_SHEET_LINK.');

  if (lastRow === 1) return {};

  // Chỉ đọc tới cột LOP/ID_SHEET_LINK, không dùng getDataRange() để tránh kéo theo
  // các cột hoặc hàng thừa từng được định dạng trong sheet INFO.
  const width = Math.max(classColumn, linkColumn) + 1;
  const values = infoSheet.getRange(2, 1, lastRow - 1, width).getDisplayValues();
  const classFiles = {};
  for (let row = 0; row < values.length; row++) {
    const className = String(values[row][classColumn] || '').trim();
    const spreadsheetId = extractSpreadsheetId_(values[row][linkColumn]);
    if (!className || !spreadsheetId) continue;
    if (classFiles[className]) {
      throw new Error('Lớp "' + className + '" bị lặp trong sheet INFO.');
    }
    classFiles[className] = spreadsheetId;
  }
  cache.put(CLASS_FILES_CACHE_KEY, JSON.stringify(classFiles), CLASS_FILES_CACHE_SECONDS);
  return classFiles;
}

/** Chạy thủ công sau khi sửa LOP hoặc ID_SHEET_LINK trong INFO để cập nhật ngay. */
function clearInfoCache() {
  CacheService.getScriptCache().remove(CLASS_FILES_CACHE_KEY);
  return 'Đã xóa bộ nhớ tạm INFO.';
}

function extractSpreadsheetId_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const urlMatch = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{25,})/);
  return urlMatch ? urlMatch[1] : '';
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
 * Chỉ trả danh sách lớp khi WebApp mở.
 * Giáo viên và môn học chỉ được đọc sau khi người dùng chọn một lớp,
 * tránh phải mở toàn bộ file lớp ngay lúc khởi động.
 */
function getAppConfig() {
  const classFiles = getClassFiles_();
  return {
    classes: Object.keys(classFiles)
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

/** Tải riêng danh sách giáo viên để ô GV không phải chờ dữ liệu cả lớp. */
function getClassTeachers(className) {
  const cleanClassName = String(className || '').trim();
  let teachers = readClassTeachersCache_(cleanClassName);
  if (!teachers) {
    const ss = openClassSpreadsheet(cleanClassName);
    teachers = getClassTeachersCached_(ss, cleanClassName);
  }
  return {
    className: cleanClassName,
    teachers: teachers
  };
}

function getClassTeachersCacheKey_(className) {
  return TEACHER_DATA_CACHE_PREFIX + normalizeHeader_(className).slice(0, 80);
}

function readClassTeachersCache_(className) {
  const cache = CacheService.getScriptCache();
  const cacheKey = getClassTeachersCacheKey_(className);
  const cached = cache.get(cacheKey);
  if (!cached) return null;
  try {
    const teachers = JSON.parse(cached);
    return Array.isArray(teachers) ? teachers : null;
  } catch (error) {
    cache.remove(cacheKey);
    return null;
  }
}

/** Danh sách GV ít thay đổi nên giữ 6 giờ; trình duyệt vẫn nhận bản mới mỗi lần chọn lớp. */
function getClassTeachersCached_(ss, className) {
  const cache = CacheService.getScriptCache();
  const cacheKey = getClassTeachersCacheKey_(className);
  const cachedTeachers = readClassTeachersCache_(className);
  if (cachedTeachers) return cachedTeachers;

  const teachers = getSimpleList_(ss, 'DanhSachGV', [
    'hovaten', 'hoten', 'tengv', 'hotengv', 'giaovien'
  ]);
  cache.put(cacheKey, JSON.stringify(teachers), ATTENDANCE_DATA_CACHE_SECONDS);
  return teachers;
}

/**
 * Tải dữ liệu lớp bằng một lượt đọc. NgayBatDau/TienDo lấy thẳng từ H/I;
 * tuyệt đối không quét 12 sheet tháng trong lúc người dùng đang chờ chọn lớp.
 */
function getClassData(className, attendanceDate) {
  const cleanClassName = String(className || '').trim();
  const ss = openClassSpreadsheet(cleanClassName);
  const subjectDetailsFromSheet = getSubjectDetails_(ss, 'DanhSachMH');
  const referenceDate = parseReferenceDateOrToday_(attendanceDate);
  const storedState = buildStoredSubjectProgressState_(referenceDate, subjectDetailsFromSheet);
  writeSubjectCache_(cleanClassName, storedState);
  const subjectDetails = mergeSubjectDetailsWithState_(
    subjectDetailsFromSheet,
    storedState
  );
  return {
    className: cleanClassName,
    teachers: getClassTeachersCached_(ss, cleanClassName),
    // DanhSachMH chỉ đọc một lần; danh sách tên môn lấy từ dữ liệu chi tiết.
    subjects: uniqueList_(subjectDetails.map(function(item) { return item.TenMH; })),
    subjectDetails: subjectDetails,
    students: getStudentList_(ss, cleanClassName)
  };
}

/** Khóa cache theo cả lớp và năm học để tháng 1–7 không lẫn với tháng 8–12. */
function getSubjectDataCacheKey_(className, schoolYearStart) {
  return SUBJECT_DATA_CACHE_PREFIX +
    normalizeHeader_(className).slice(0, 70) + '_' + Number(schoolYearStart);
}

function readSubjectCache_(className, schoolYearStart) {
  const cache = CacheService.getScriptCache();
  const key = getSubjectDataCacheKey_(className, schoolYearStart);
  const cached = cache.get(key);
  if (!cached) return null;
  try {
    const state = JSON.parse(cached);
    return state && state.subjects ? state : null;
  } catch (error) {
    cache.remove(key);
    return null;
  }
}

function writeSubjectCache_(className, state) {
  CacheService.getScriptCache().put(
    getSubjectDataCacheKey_(className, state.schoolYearStart),
    JSON.stringify(state),
    ATTENDANCE_DATA_CACHE_SECONDS
  );
}

function mergeSubjectDetailsWithState_(subjectDetails, state) {
  return (subjectDetails || []).map(function(detail) {
    const copy = Object.assign({}, detail);
    const key = normalizeVietnameseText_(detail.TenMH);
    const item = state && state.subjects ? state.subjects[key] : null;
    if (!item) return copy;
    copy.NgayBatDau = item.NgayBatDau || '';
    copy.TienDo = item.TienDo || '0';
    copy._StoredNgayBatDau = item.StoredNgayBatDau || '';
    copy._StoredTienDo = item.StoredTienDo || '0';
    copy._SchoolYearStart = state.schoolYearStart;
    return copy;
  });
}

/**
 * Khi tải lớp: ưu tiên H/I đã có. Chỉ khi một trường còn trống mới tính từ
 * các sheet tháng và ghi đúng trường còn thiếu vào DanhSachMH.
 */
function initializeSubjectProgressForClass_(ss, className, referenceDate, lockAlreadyHeld) {
  let details = getSubjectDetails_(ss, 'DanhSachMH');
  if (!hasMissingStoredSubjectProgress_(details)) {
    const storedState = buildStoredSubjectProgressState_(referenceDate, details);
    writeSubjectCache_(className, storedState);
    return { details: details, state: storedState };
  }

  const lock = lockAlreadyHeld ? null : LockService.getScriptLock();
  if (lock) lock.waitLock(20000);
  try {
    // Có thể thiết bị khác vừa khởi tạo H/I; đọc lại sau khi lấy khóa.
    details = getSubjectDetails_(ss, 'DanhSachMH');
    if (!hasMissingStoredSubjectProgress_(details)) {
      const storedState = buildStoredSubjectProgressState_(referenceDate, details);
      writeSubjectCache_(className, storedState);
      return { details: details, state: storedState };
    }

    // H hoặc I bị trống có thể do người dùng vừa chủ động xóa để yêu cầu
    // tính lại. Tuyệt đối không dùng kết quả cache cũ trong trường hợp này.
    // Luôn quét lại các sheet tháng để Google Sheets phản ánh dữ liệu hiện tại.
    const state = buildSubjectProgressState_(ss, referenceDate, details);
    applyMissingSubjectProgress_(ss, details, state);
    writeSubjectCache_(className, state);
    return { details: details, state: state };
  } finally {
    if (lock) lock.releaseLock();
  }
}

function hasMissingStoredSubjectProgress_(details) {
  return (details || []).some(function(item) {
    return !String(item.NgayBatDau || '').trim() ||
      String(item.TienDo == null ? '' : item.TienDo).trim() === '';
  });
}

/** Dựng cache trực tiếp từ H/I, hoàn toàn không quét các sheet tháng. */
function buildStoredSubjectProgressState_(referenceDate, details) {
  const state = {
    schoolYearStart: getAcademicYearStartYear_(referenceDate),
    subjects: {}
  };
  (details || []).forEach(function(detail) {
    const name = String(detail.TenMH || '').trim();
    const key = normalizeVietnameseText_(name);
    if (!key) return;
    if (state.subjects[key]) throw new Error('DanhSachMH có tên môn bị trùng: ' + name + '.');
    const storedProgress = String(detail.TienDo == null ? '' : detail.TienDo).trim();
    state.subjects[key] = {
      name: name,
      row: Number(detail._Row) || 0,
      subjectColumn: Number(detail._SubjectColumn) || 0,
      startDateColumn: Number(detail._StartDateColumn) || SUBJECT_START_DATE_COLUMN,
      progressColumn: Number(detail._ProgressColumn) || SUBJECT_PROGRESS_COLUMN,
      TongSoGio: String(detail.TongSoGio || '').trim(),
      StoredNgayBatDau: String(detail.NgayBatDau || '').trim(),
      StoredTienDo: storedProgress,
      NgayBatDau: String(detail.NgayBatDau || '').trim(),
      TienDo: storedProgress || '0',
      sessions: {}
    };
  });
  return state;
}

/** Chỉ ghi ô H/I đang trống; giá trị đã có trong Google Sheets được giữ nguyên. */
function applyMissingSubjectProgress_(ss, details, state) {
  const sheet = requireSheet_(ss, 'DanhSachMH');
  (details || []).forEach(function(detail) {
    const key = normalizeVietnameseText_(detail.TenMH);
    const item = state.subjects[key];
    if (!item) return;

    item.name = String(detail.TenMH || '').trim();
    item.row = Number(detail._Row) || 0;
    item.subjectColumn = Number(detail._SubjectColumn) || 0;
    item.startDateColumn = Number(detail._StartDateColumn) || SUBJECT_START_DATE_COLUMN;
    item.progressColumn = Number(detail._ProgressColumn) || SUBJECT_PROGRESS_COLUMN;
    item.TongSoGio = String(detail.TongSoGio || '').trim();

    const storedStart = String(detail.NgayBatDau || '').trim();
    if (storedStart) {
      item.NgayBatDau = storedStart;
      item.StoredNgayBatDau = storedStart;
    } else if (item.NgayBatDau) {
      const dateKey = normalizedDateKey_(item.NgayBatDau);
      if (dateKey) {
        sheet.getRange(item.row, item.startDateColumn)
          .setValue(parseReferenceDateOrToday_(dateKey))
          .setNumberFormat('dd/MM/yyyy');
        detail.NgayBatDau = item.NgayBatDau;
        item.StoredNgayBatDau = item.NgayBatDau;
      }
    }

    const storedProgress = String(detail.TienDo == null ? '' : detail.TienDo).trim();
    if (storedProgress !== '') {
      item.TienDo = storedProgress;
      item.StoredTienDo = storedProgress;
    } else {
      const hours = Number(String(item.TienDo || '0').replace(',', '.')) || 0;
      sheet.getRange(item.row, item.progressColumn).setValue(hours).setNumberFormat('0');
      detail.TienDo = String(hours);
      item.TienDo = String(hours);
      item.StoredTienDo = String(hours);
    }
  });
}

/**
 * Lấy đúng một môn từ bộ nhớ. Nếu cache bị Google thu hồi, dùng dữ liệu mà
 * Index.html đã nạp lúc chọn lớp; chỉ đọc lại DanhSachMH khi cả hai đều thiếu.
 */
function resolveCachedSubject_(
  ss,
  className,
  subjectName,
  targetDate,
  subjectSnapshot,
  lockAlreadyHeld
) {
  const subjectKey = normalizeVietnameseText_(subjectName);
  const schoolYearStart = getAcademicYearStartYear_(targetDate);
  let state = readSubjectCache_(className, schoolYearStart);
  if (
    state && state.subjects[subjectKey] &&
    normalizeVietnameseText_(state.subjects[subjectKey].name) === subjectKey
  ) {
    return { state: state, key: subjectKey, item: state.subjects[subjectKey] };
  }

  const snapshot = subjectSnapshot && typeof subjectSnapshot === 'object'
    ? subjectSnapshot
    : null;
  const snapshotCanBeChecked = Boolean(
    snapshot && Number(snapshot.row) >= 2 &&
    Number(snapshot.subjectColumn) >= 1 &&
    normalizeVietnameseText_(snapshot.TenMH) === subjectKey &&
    Number(snapshot.schoolYearStart) === schoolYearStart
  );
  const snapshotActualSubject = snapshotCanBeChecked
    ? requireSheet_(ss, 'DanhSachMH')
      .getRange(Number(snapshot.row), Number(snapshot.subjectColumn))
      .getDisplayValue()
    : '';
  if (snapshotCanBeChecked && normalizeVietnameseText_(snapshotActualSubject) === subjectKey) {
    state = state || { schoolYearStart: schoolYearStart, subjects: {} };
    state.subjects[subjectKey] = {
      name: String(snapshot.TenMH || '').trim(),
      row: Number(snapshot.row),
      subjectColumn: Number(snapshot.subjectColumn) || 0,
      startDateColumn: Number(snapshot.startDateColumn) || SUBJECT_START_DATE_COLUMN,
      progressColumn: Number(snapshot.progressColumn) || SUBJECT_PROGRESS_COLUMN,
      NgayBatDau: String(snapshot.NgayBatDau || '').trim(),
      TienDo: String(snapshot.TienDo || '0').trim(),
      TongSoGio: String(snapshot.TongSoGio || '').trim(),
      StoredNgayBatDau: String(snapshot.StoredNgayBatDau || '').trim(),
      StoredTienDo: String(snapshot.StoredTienDo || '0').trim(),
      sessions: {}
    };
    writeSubjectCache_(className, state);
    return { state: state, key: subjectKey, item: state.subjects[subjectKey] };
  }

  // Cache có thể bị Google thu hồi trước thời hạn. Khi đó vẫn phải ưu tiên H/I;
  // chỉ quét các sheet tháng nếu một trong hai trường thực sự đang trống.
  const initialized = initializeSubjectProgressForClass_(
    ss,
    className,
    targetDate,
    Boolean(lockAlreadyHeld)
  );
  state = initialized.state;
  return {
    state: state,
    key: subjectKey,
    item: state.subjects[subjectKey] || null
  };
}

/** Lưu hoặc xóa GhiChu của đúng học sinh trong DanhSachHS. */
function saveStudentNote(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Dữ liệu ghi chú không hợp lệ.');
  const className = String(payload.className || '').trim();
  const studentSTT = String(payload.studentSTT || '').trim();
  const studentName = String(payload.studentName || '').trim();
  const note = String(payload.note == null ? '' : payload.note).trim();

  if (!className || !studentSTT || !studentName) {
    throw new Error('Chưa xác định đầy đủ lớp và học sinh cần ghi chú.');
  }
  if (note.length > 1000) throw new Error('Ghi chú không được dài quá 1.000 ký tự.');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = openClassSpreadsheet(className);
    const sheet = requireSheet_(ss, 'DanhSachHS');
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow < 2) throw new Error('DanhSachHS chưa có học sinh.');

    const values = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
    const headers = values[0].map(normalizeHeader_);
    const columns = {
      STT: findHeaderColumn_(headers, ['stt', 'tt']),
      HoVaTen: findHeaderColumn_(headers, ['hovaten', 'hoten', 'tenhocsinh']),
      GhiChu: findHeaderColumn_(headers, ['ghichu'])
    };
    Object.keys(columns).forEach(function(key) {
      if (columns[key] === -1) throw new Error('DanhSachHS thiếu cột ' + key + '.');
    });

    let targetRow = -1;
    const wantedName = normalizeVietnameseText_(studentName);
    for (let row = 1; row < values.length; row++) {
      const rowSTT = String(values[row][columns.STT] || '').trim();
      const rowName = normalizeVietnameseText_(values[row][columns.HoVaTen]);
      if ((rowSTT && Number(rowSTT) === Number(studentSTT)) || rowName === wantedName) {
        targetRow = row + 1;
        break;
      }
    }
    if (targetRow === -1) throw new Error('Không tìm thấy học sinh trong lớp ' + className + '.');

    const noteCell = sheet.getRange(targetRow, columns.GhiChu + 1);
    if (note) noteCell.setValue(note);
    else noteCell.clearContent();
    SpreadsheetApp.flush();

    return {
      ok: true,
      className: className,
      studentSTT: studentSTT,
      studentName: studentName,
      note: note
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Chỉ dùng cho Cài đặt > Ảnh đại diện.
 * Tách riêng khỏi getClassData để trang Điểm danh không phải gọi Drive kiểm tra
 * từng LinkAnh, nhờ đó tải lớp nhanh hơn.
 */
function getAvatarClassData(className) {
  const cleanClassName = String(className || '').trim();
  const ss = openClassSpreadsheet(cleanClassName);
  return {
    className: cleanClassName,
    students: getStudentList_(ss, cleanClassName, true)
  };
}

/**
 * Trả ảnh của đúng học sinh qua WebApp khi trình duyệt không được Drive cho mở
 * đường dẫn thumbnail trực tiếp. Chỉ đọc LinkAnh từ Sheet, không nhận ID file
 * tùy ý từ phía trình duyệt.
 */
function getStudentProfilePhotoData(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Dữ liệu lấy ảnh không hợp lệ.');
  const className = String(payload.className || '').trim();
  const studentSTT = String(payload.studentSTT || '').trim();
  const studentName = String(payload.studentName || '').trim();
  if (!className || (!studentSTT && !studentName)) throw new Error('Chưa xác định được học sinh cần lấy ảnh.');

  const ss = openClassSpreadsheet(className);
  return buildStudentProfilePhotoData_(getStudentList_(ss, className), studentSTT, studentName, className);
}

/** Lấy ngầm tối đa 3 ảnh lân cận trong một lần gọi để giảm thời gian chờ khi vuốt. */
function getStudentProfilePhotosData(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Dữ liệu chuẩn bị ảnh không hợp lệ.');
  const className = String(payload.className || '').trim();
  const requestedStudents = Array.isArray(payload.students) ? payload.students.slice(0, 3) : [];
  if (!className || !requestedStudents.length) return { ok: true, photos: [] };

  const ss = openClassSpreadsheet(className);
  const classStudents = getStudentList_(ss, className);
  const photos = [];
  requestedStudents.forEach(function(ref) {
    try {
      photos.push(buildStudentProfilePhotoData_(
        classStudents,
        String(ref && ref.studentSTT || '').trim(),
        String(ref && ref.studentName || '').trim(),
        className
      ));
    } catch (error) {
      // Một ảnh lỗi không được làm hỏng toàn bộ nhóm ảnh đang chuẩn bị.
    }
  });
  return { ok: true, photos: photos };
}

function buildStudentProfilePhotoData_(classStudents, studentSTT, studentName, className) {
  const student = classStudents.find(function(item) {
    const sameSTT = studentSTT && String(item.STT || '').trim() &&
      Number(item.STT) === Number(studentSTT);
    const sameName = studentName &&
      normalizeVietnameseText_(item.HoVaTen) === normalizeVietnameseText_(studentName);
    return sameSTT || sameName;
  });
  if (!student) throw new Error('Không tìm thấy học sinh trong lớp ' + className + '.');

  const fileId = extractDriveFileId_(student.LinkAnh);
  if (!fileId) throw new Error('Học sinh chưa có ảnh đại diện hợp lệ.');
  const file = DriveApp.getFileById(fileId);
  if (file.isTrashed()) throw new Error('Ảnh đại diện không còn tồn tại.');

  const blob = file.getBlob();
  const mimeType = String(blob.getContentType() || 'image/jpeg');
  if (mimeType.indexOf('image/') !== 0) throw new Error('LinkAnh không trỏ tới file ảnh.');
  const bytes = blob.getBytes();
  if (bytes.length > 2 * 1024 * 1024) throw new Error('Ảnh đại diện vượt quá 2 MB.');
  return {
    ok: true,
    studentSTT: student.STT,
    studentName: student.HoVaTen,
    linkAnh: student.LinkAnh,
    photoDataUrl: 'data:' + mimeType + ';base64,' + Utilities.base64Encode(bytes)
  };
}

/** Chỉ lưu 5 vector và trạng thái đăng ký khuôn mặt. Video/ảnh không được tải lên Drive. */
function saveFaceRegistration(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Dữ liệu đăng ký không hợp lệ.');
  const className = String(payload.className || '').trim();
  const studentSTT = String(payload.studentSTT || '').trim();
  const studentName = String(payload.studentName || '').trim();
  const vectors = Array.isArray(payload.vectors) ? payload.vectors : [];

  if (!className || !studentSTT || !studentName) throw new Error('Chưa chọn đầy đủ lớp và học sinh.');
  if (vectors.length !== 5) throw new Error('Phải có đúng 5 vector khuôn mặt.');
  vectors.forEach(function(vector, index) {
    if (!Array.isArray(vector) || vector.length !== 128 ||
        vector.some(function(value) { return !isFinite(Number(value)); })) {
      throw new Error('Vector' + (index + 1) + ' không hợp lệ.');
    }
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = openClassSpreadsheet(className);
    const sheet = requireSheet_(ss, 'DanhSachHS');
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow < 2) throw new Error('DanhSachHS chưa có học sinh.');

    const values = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
    const headers = values[0].map(normalizeHeader_);
    const columns = {
      STT: findHeaderColumn_(headers, ['stt', 'tt']),
      HoVaTen: findHeaderColumn_(headers, ['hovaten', 'hoten', 'tenhocsinh']),
      Vector1: findHeaderColumn_(headers, ['vector1']),
      Vector2: findHeaderColumn_(headers, ['vector2']),
      Vector3: findHeaderColumn_(headers, ['vector3']),
      Vector4: findHeaderColumn_(headers, ['vector4']),
      Vector5: findHeaderColumn_(headers, ['vector5']),
      NgayCapNhat: findHeaderColumn_(headers, ['ngaycapnhat']),
      TrangThai: findHeaderColumn_(headers, ['trangthai'])
    };
    Object.keys(columns).forEach(function(key) {
      if (columns[key] === -1) throw new Error('DanhSachHS thiếu cột ' + key + '.');
    });

    let targetRow = -1;
    for (let row = 1; row < values.length; row++) {
      const rowSTT = String(values[row][columns.STT] || '').trim();
      const rowName = normalizeVietnameseText_(values[row][columns.HoVaTen]);
      if ((rowSTT && Number(rowSTT) === Number(studentSTT)) ||
          rowName === normalizeVietnameseText_(studentName)) {
        targetRow = row + 1;
        break;
      }
    }
    if (targetRow === -1) throw new Error('Không tìm thấy học sinh trong lớp ' + className + '.');

    const rowRange = sheet.getRange(targetRow, 1, 1, lastColumn);
    const rowValues = rowRange.getValues()[0];
    for (let i = 0; i < 5; i++) rowValues[columns['Vector' + (i + 1)]] = JSON.stringify(vectors[i]);
    const now = new Date();
    rowValues[columns.NgayCapNhat] = now;
    rowValues[columns.TrangThai] = 'Đã đăng ký';
    rowRange.setValues([rowValues]);

    return {
      ok: true,
      className: className,
      studentSTT: studentSTT,
      studentName: studentName,
      vectors: vectors,
      ngayCapNhat: Utilities.formatDate(now, ss.getSpreadsheetTimeZone() || 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss'),
      trangThai: 'Đã đăng ký'
    };
  } finally {
    lock.releaseLock();
  }
}

/** Lưu riêng ảnh đại diện và LinkAnh; không thay đổi vector, ngày hoặc trạng thái Face ID. */
function saveStudentProfilePhoto(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Dữ liệu ảnh đại diện không hợp lệ.');
  const className = String(payload.className || '').trim();
  const studentSTT = String(payload.studentSTT || '').trim();
  const studentName = String(payload.studentName || '').trim();
  const photoDataUrl = String(payload.photoDataUrl || '');
  if (!className || !studentSTT || !studentName) throw new Error('Chưa chọn đầy đủ lớp và học sinh.');
  if (!/^data:image\/jpeg;base64,/.test(photoDataUrl)) throw new Error('Ảnh đại diện không đúng định dạng JPEG.');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = openClassSpreadsheet(className);
    const sheet = requireSheet_(ss, 'DanhSachHS');
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow < 2) throw new Error('DanhSachHS chưa có học sinh.');
    const values = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
    const headers = values[0].map(normalizeHeader_);
    const columns = {
      STT: findHeaderColumn_(headers, ['stt', 'tt']),
      HoVaTen: findHeaderColumn_(headers, ['hovaten', 'hoten', 'tenhocsinh']),
      LinkAnh: findHeaderColumn_(headers, ['linkanh'])
    };
    Object.keys(columns).forEach(function(key) {
      if (columns[key] === -1) throw new Error('DanhSachHS thiếu cột ' + key + '.');
    });

    let targetRow = -1;
    for (let row = 1; row < values.length; row++) {
      const rowSTT = String(values[row][columns.STT] || '').trim();
      const rowName = normalizeVietnameseText_(values[row][columns.HoVaTen]);
      if ((rowSTT && Number(rowSTT) === Number(studentSTT)) ||
          rowName === normalizeVietnameseText_(studentName)) {
        targetRow = row + 1;
        break;
      }
    }
    if (targetRow === -1) throw new Error('Không tìm thấy học sinh trong lớp ' + className + '.');

    const rootFolder = DriveApp.getFolderById(SCHOOL_YEAR_FOLDER_ID);
    const imageRoot = getOrCreateChildFolder_(rootFolder, STUDENT_IMAGE_FOLDER_NAME);
    const classFolder = getOrCreateChildFolder_(imageRoot, className);
    const fileName = formatStudentPhotoFileName_(studentSTT, studentName);
    const imageBytes = Utilities.base64Decode(photoDataUrl.split(',')[1]);
    const newFile = classFolder.createFile(Utilities.newBlob(imageBytes, 'image/jpeg', fileName));
    const sameNameFiles = classFolder.getFilesByName(fileName);
    while (sameNameFiles.hasNext()) {
      const file = sameNameFiles.next();
      if (file.getId() !== newFile.getId()) file.setTrashed(true);
    }
    sheet.getRange(targetRow, columns.LinkAnh + 1).setValue(newFile.getUrl());
    return { ok: true, className: className, studentSTT: studentSTT,
      studentName: studentName, linkAnh: newFile.getUrl() };
  } finally {
    lock.releaseLock();
  }
}

/** Đưa ảnh đại diện hiện tại vào thùng rác Drive và xóa LinkAnh trong DanhSachHS. */
function deleteStudentProfilePhoto(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Dữ liệu xóa ảnh không hợp lệ.');
  const className = String(payload.className || '').trim();
  const studentSTT = String(payload.studentSTT || '').trim();
  const studentName = String(payload.studentName || '').trim();
  if (!className || !studentSTT || !studentName) throw new Error('Chưa chọn đầy đủ lớp và học sinh.');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = openClassSpreadsheet(className);
    const sheet = requireSheet_(ss, 'DanhSachHS');
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow < 2) throw new Error('DanhSachHS chưa có học sinh.');

    const values = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
    const headers = values[0].map(normalizeHeader_);
    const columns = {
      STT: findHeaderColumn_(headers, ['stt', 'tt']),
      HoVaTen: findHeaderColumn_(headers, ['hovaten', 'hoten', 'tenhocsinh']),
      LinkAnh: findHeaderColumn_(headers, ['linkanh'])
    };
    Object.keys(columns).forEach(function(key) {
      if (columns[key] === -1) throw new Error('DanhSachHS thiếu cột ' + key + '.');
    });

    let targetRow = -1;
    for (let row = 1; row < values.length; row++) {
      const rowSTT = String(values[row][columns.STT] || '').trim();
      const rowName = normalizeVietnameseText_(values[row][columns.HoVaTen]);
      if ((rowSTT && Number(rowSTT) === Number(studentSTT)) ||
          rowName === normalizeVietnameseText_(studentName)) {
        targetRow = row + 1;
        break;
      }
    }
    if (targetRow === -1) throw new Error('Không tìm thấy học sinh trong lớp ' + className + '.');

    const linkAnh = String(values[targetRow - 1][columns.LinkAnh] || '').trim();
    const fileId = extractDriveFileId_(linkAnh);
    let driveFileTrashed = false;
    if (fileId) {
      // Nút Xóa chỉ xuất hiện sau khi mục Ảnh đại diện đã xác minh file này.
      // Nếu Drive từ chối thao tác thì hàm dừng, không xóa LinkAnh để tránh báo sai.
      const file = DriveApp.getFileById(fileId);
      if (!file.isTrashed()) file.setTrashed(true);
      driveFileTrashed = true;
    }

    sheet.getRange(targetRow, columns.LinkAnh + 1).clearContent();
    SpreadsheetApp.flush();
    return {
      ok: true,
      className: className,
      studentSTT: studentSTT,
      studentName: studentName,
      driveFileTrashed: driveFileTrashed,
      linkCleared: true
    };
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateChildFolder_(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(String(folderName || '').trim());
  return folders.hasNext() ? folders.next() : parentFolder.createFolder(String(folderName || '').trim());
}

function formatStudentPhotoFileName_(studentSTT, studentName) {
  const stt = String(Math.max(0, Number(studentSTT) || 0)).padStart(3, '0');
  const cleanName = String(studentName || '').trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/Đ/g, 'D').replace(/đ/g, 'd')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ');
  return stt + ' - ' + cleanName + '.jpg';
}

/** Lấy ID file ảnh từ các dạng liên kết Google Drive thường dùng. */
function extractDriveFileId_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]{20,})/,
    /[?&]id=([a-zA-Z0-9_-]{20,})/,
    /\/d\/([a-zA-Z0-9_-]{20,})/
  ];
  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);
    if (match) return match[1];
  }
  return /^[a-zA-Z0-9_-]{20,}$/.test(text) ? text : '';
}

/**
 * Chỉ công nhận ảnh khi file còn tồn tại trên Drive và không nằm trong thùng rác.
 * Link sai, file đã xóa hoặc WebApp không còn quyền truy cập đều được xem là mất ảnh.
 */
function studentPhotoExists_(link) {
  const fileId = extractDriveFileId_(link);
  if (!fileId) return false;
  try {
    return !DriveApp.getFileById(fileId).isTrashed();
  } catch (error) {
    return false;
  }
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

  const subjectName = String(payload.subject || '').trim();
  const teacherName = String(payload.teacher || '').trim();
  if (!subjectName) throw new Error('Chưa chọn môn học.');

  // Mở file và tìm dòng học sinh trước khi khóa. Đây là các bước chỉ đọc,
  // không nên bắt những lượt lưu khác phải chờ theo.
  const ss = openClassSpreadsheet(className);
  let sheet = findMonthSheet_(ss, targetDate.getMonth() + 1);
  let studentRow = getMonthlyStudentRowCached_(
    sheet,
    className,
    payload.studentSTT,
    payload.studentName
  );

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const slot = getAttendanceSlot_(ss, className, targetDate, session);
    if (sheet.getName() !== slot.sheetName) {
      sheet = ss.getSheetByName(slot.sheetName);
      if (sheet) {
        studentRow = getMonthlyStudentRowCached_(
          sheet,
          className,
          payload.studentSTT,
          payload.studentName
        );
      }
    }
    if (!sheet) throw new Error('Không tìm thấy sheet ' + slot.sheetName + '.');

    const wantedSubject = normalizeVietnameseText_(subjectName);
    const previousNormalizedSubject = normalizeVietnameseText_(slot.subjectLogical);
    const sessionAlreadyCounted = Boolean(
      wantedSubject && previousNormalizedSubject === wantedSubject
    );

    const mark = status === 'ABSENT' ? 'V' : status === 'EXCUSED' ? 'P' : '';
    const attendanceRange = sheet.getRange(studentRow, slot.column);
    attendanceRange.setValue(mark);
    let slotChanged = false;

    // Giáo viên và môn thường giống nhau cho cả lớp: chỉ ghi lần đầu hoặc khi đổi.
    if (slot.teacherRow && teacherName && slot.teacherDirect !== teacherName) {
      sheet.getRange(slot.teacherRow, slot.column).setValue(teacherName);
      slot.teacherDirect = teacherName;
      slotChanged = true;
    }
    if (slot.subjectRow && previousNormalizedSubject !== wantedSubject) {
      sheet.getRange(slot.subjectRow, slot.subjectWriteColumn || slot.column).setValue(subjectName);
      slot.subjectDirect = subjectName;
      slotChanged = true;
    }

    // Nếu đây là lần đầu môn học được ghi vào cột S/C này thì cộng một buổi
    // (4 giờ). Điểm danh bù sớm hơn sẽ tự điều chỉnh lại NgayBatDau.
    let updatedSubject;
    if (previousNormalizedSubject && previousNormalizedSubject !== wantedSubject) {
      // Trường hợp đổi môn của một cột đã có dữ liệu: tính lại toàn bộ để
      // đồng thời trừ tiến độ của môn cũ và cộng đúng cho môn mới.
      SpreadsheetApp.flush();
      const rebuiltState = rebuildSubjectProgress_(ss, className, targetDate, true);
      updatedSubject = rebuiltState.subjects[wantedSubject] || {};
    } else {
      const fastSnapshot = getFastSubjectSnapshot_(
        subjectName,
        targetDate,
        payload.subjectSnapshot
      );
      // Từ học sinh thứ hai của cùng buổi: nếu GV/môn và H/I đã đúng thì chỉ
      // ghi ô điểm danh, không đọc/ghi lại DanhSachMH hay cache tiến độ.
      updatedSubject = sessionAlreadyCounted && fastSnapshot && !fastSnapshot.needsSync
        ? fastSnapshot
        : updateSubjectProgressAfterAttendance_(
          ss,
          className,
          subjectName,
          targetDate,
          sessionAlreadyCounted,
          payload.subjectSnapshot
        );
    }
    if (previousNormalizedSubject !== wantedSubject) {
      slot.subjectLogical = subjectName;
      slotChanged = true;
    }
    if (slotChanged) saveAttendanceSlotCache_(slot);
    updatedSubject = updatedSubject || {};

    const today = new Date();
    const isMakeup = !sameDate_(today, targetDate);
    return {
      ok: true,
      className: className,
      sheetName: sheet.getName(),
      cell: attendanceRange.getA1Notation(),
      mark: mark,
      session: session,
      attendanceDate: dateText,
      isMakeup: isMakeup,
      attendanceStatuses: getAttendanceStatusesForSlot_(sheet, slot),
      subjectProgress: {
        NgayBatDau: updatedSubject.NgayBatDau || '',
        TienDo: updatedSubject.TienDo || '0',
        StoredNgayBatDau: updatedSubject.StoredNgayBatDau || updatedSubject.NgayBatDau || '',
        StoredTienDo: updatedSubject.StoredTienDo || updatedSubject.TienDo || '0',
        schoolYearStart: getAcademicYearStartYear_(targetDate)
      }
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Nạp ngầm vị trí ngày/buổi và bảng dòng học sinh trước khi GV bấm điểm danh.
 * Hàm chỉ đọc, không ghi dữ liệu.
 */
function prepareAttendanceSession(payload) {
  if (!payload || typeof payload !== 'object') return { ok: false };
  const className = String(payload.className || '').trim();
  const dateText = String(payload.attendanceDate || '').trim();
  const session = String(payload.session || '').trim().toUpperCase();
  if (!getClassFiles_()[className] || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return { ok: false };
  }
  if (session !== 'S' && session !== 'C') return { ok: false };

  const parts = dateText.split('-').map(Number);
  const targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
  if (
    targetDate.getFullYear() !== parts[0] ||
    targetDate.getMonth() !== parts[1] - 1 ||
    targetDate.getDate() !== parts[2]
  ) return { ok: false };

  const ss = openClassSpreadsheet(className);
  const slot = getAttendanceSlot_(ss, className, targetDate, session);
  const sheet = ss.getSheetByName(slot.sheetName);
  if (sheet && (payload.studentSTT || payload.studentName)) {
    getMonthlyStudentRowCached_(
      sheet,
      className,
      payload.studentSTT,
      payload.studentName
    );
  }
  let subjectProgress = null;
  const subjectName = String(payload.subject || '').trim();
  if (subjectName) {
    const resolved = resolveCachedSubject_(ss, className, subjectName, targetDate, null, false);
    if (resolved.item) {
      subjectProgress = {
        subject: resolved.item.name || subjectName,
        NgayBatDau: resolved.item.NgayBatDau || '',
        TienDo: resolved.item.TienDo || '0',
        StoredNgayBatDau: resolved.item.StoredNgayBatDau || '',
        StoredTienDo: resolved.item.StoredTienDo || '0',
        schoolYearStart: resolved.state.schoolYearStart
      };
    }
  }
  return {
    ok: true,
    sheetName: slot.sheetName,
    column: slot.column,
    subjectProgress: subjectProgress,
    // Ô trống là Có mặt theo quy ước hiện có của ứng dụng. Nếu buổi này chưa
    // có môn học, chưa có điểm danh nên không trả trạng thái nào (Index hiển thị —).
    attendanceStatuses: getAttendanceStatusesForSlot_(sheet, slot)
  };
}

/** Trả trạng thái cả lớp của đúng một cột ngày/buổi cho cửa sổ Danh sách lớp. */
function getAttendanceStatusesForSlot_(sheet, slot) {
  const subject = String(slot && (slot.subjectLogical || slot.subjectDirect) || '').trim();
  if (!sheet || !slot || !slot.column || !subject) return [];
  const rowCount = sheet.getLastRow() - ATTENDANCE_FIRST_STUDENT_ROW + 1;
  if (rowCount < 1) return [];

  const identities = sheet.getRange(ATTENDANCE_FIRST_STUDENT_ROW, 1, rowCount, 2).getDisplayValues();
  const marks = sheet.getRange(ATTENDANCE_FIRST_STUDENT_ROW, slot.column, rowCount, 1).getDisplayValues();
  return identities.reduce(function(result, identity, index) {
    const studentSTT = normalizeStudentSTT_(identity[0]);
    if (!studentSTT) return result;
    const mark = String((marks[index] || [])[0] || '').trim().toUpperCase();
    result.push({
      studentSTT: studentSTT,
      status: mark === 'V' ? 'ABSENT' : mark === 'P' ? 'EXCUSED' : 'PRESENT'
    });
    return result;
  }, []);
}

/**
 * Vị trí cột ngày/buổi và các dòng GV, môn học chỉ dò một lần; các học sinh
 * tiếp theo của cùng buổi dùng thẳng kết quả trong cache.
 */
function getAttendanceSlot_(ss, className, targetDate, session) {
  const cacheKey = ATTENDANCE_SLOT_CACHE_PREFIX +
    normalizeHeader_(className).slice(0, 60) + '_' +
    formatDateKey_(targetDate) + '_' + session;
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      const slot = JSON.parse(cached);
      if (slot && slot.sheetName && slot.column) {
        slot.cacheKey = cacheKey;
        return slot;
      }
    } catch (error) {
      cache.remove(cacheKey);
    }
  }

  const sheet = findMonthSheet_(ss, targetDate.getMonth() + 1);
  const headerColumns = sheet.getLastColumn();
  if (sheet.getLastRow() < ATTENDANCE_SUBJECT_ROW || headerColumns < ATTENDANCE_FIRST_COLUMN) {
    throw new Error('Sheet ' + sheet.getName() + ' chưa có tiêu đề điểm danh.');
  }
  const headerRange = sheet.getRange(
    ATTENDANCE_DATE_ROW,
    ATTENDANCE_FIRST_COLUMN,
    ATTENDANCE_SUBJECT_ROW - ATTENDANCE_DATE_ROW + 1,
    headerColumns - ATTENDANCE_FIRST_COLUMN + 1
  );
  const raw = headerRange.getValues();
  const display = headerRange.getDisplayValues();
  const attendanceCell = findAttendanceColumnByLayout_(raw, display, targetDate, session);
  const rangeColumnIndex = attendanceCell.column - ATTENDANCE_FIRST_COLUMN;
  const subjectRowIndex = ATTENDANCE_SUBJECT_ROW - ATTENDANCE_DATE_ROW;
  const teacherRowIndex = ATTENDANCE_TEACHER_ROW - ATTENDANCE_DATE_ROW;
  const subjectDirect = String((display[subjectRowIndex] || [])[rangeColumnIndex] || '').trim();
  const slot = {
    cacheKey: cacheKey,
    sheetName: sheet.getName(),
    column: attendanceCell.column,
    subjectRow: ATTENDANCE_SUBJECT_ROW,
    teacherRow: ATTENDANCE_TEACHER_ROW,
    subjectDirect: subjectDirect,
    subjectLogical: subjectDirect,
    subjectWriteColumn: attendanceCell.column,
    teacherDirect: String((display[teacherRowIndex] || [])[rangeColumnIndex] || '').trim()
  };
  saveAttendanceSlotCache_(slot);
  return slot;
}

function saveAttendanceSlotCache_(slot) {
  if (!slot || !slot.cacheKey) return;
  const cacheValue = {
    sheetName: slot.sheetName,
    column: slot.column,
    subjectRow: slot.subjectRow,
    teacherRow: slot.teacherRow,
    subjectDirect: slot.subjectDirect || '',
    subjectLogical: slot.subjectLogical || '',
    subjectWriteColumn: slot.subjectWriteColumn || slot.column,
    teacherDirect: slot.teacherDirect || ''
  };
  CacheService.getScriptCache().put(
    slot.cacheKey,
    JSON.stringify(cacheValue),
    ATTENDANCE_DATA_CACHE_SECONDS
  );
}

/** Dòng của học sinh trong sheet tháng chỉ đọc một lần cho mỗi lớp/tháng. */
function getMonthlyStudentRowCached_(sheet, className, studentSTT, studentName) {
  const cacheKey = MONTH_STUDENT_CACHE_PREFIX +
    normalizeHeader_(className).slice(0, 60) + '_' + sheet.getSheetId();
  const cache = CacheService.getScriptCache();
  let studentMap = null;
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      studentMap = JSON.parse(cached);
    } catch (error) {
      cache.remove(cacheKey);
    }
  }

  let row = findStudentRowInMap_(studentMap, studentSTT, studentName);
  if (row) return row;

  const firstStudentRow = ATTENDANCE_FIRST_STUDENT_ROW;
  const rowCount = sheet.getLastRow() - firstStudentRow + 1;
  if (rowCount < 1) throw new Error('Sheet tháng chưa có danh sách học sinh.');
  const values = sheet.getRange(firstStudentRow, 1, rowCount, 2).getDisplayValues();
  studentMap = { bySTT: {}, byName: {} };
  values.forEach(function(item, index) {
    const sheetRow = firstStudentRow + index;
    const sttKey = normalizeStudentSTT_(item[0]);
    const nameKey = normalizeVietnameseText_(item[1]);
    if (sttKey) studentMap.bySTT[sttKey] = sheetRow;
    if (nameKey) studentMap.byName[nameKey] = sheetRow;
  });
  cache.put(cacheKey, JSON.stringify(studentMap), ATTENDANCE_DATA_CACHE_SECONDS);

  row = findStudentRowInMap_(studentMap, studentSTT, studentName);
  if (row) return row;
  throw new Error('Không tìm thấy học sinh ' + (studentName || studentSTT) + ' trong sheet tháng.');
}

function findStudentRowInMap_(studentMap, studentSTT, studentName) {
  if (!studentMap) return 0;
  const sttKey = normalizeStudentSTT_(studentSTT);
  const nameKey = normalizeVietnameseText_(studentName);
  return Number(
    (sttKey && studentMap.bySTT && studentMap.bySTT[sttKey]) ||
    (nameKey && studentMap.byName && studentMap.byName[nameKey]) ||
    0
  );
}

function normalizeStudentSTT_(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text) return '';
  const number = Number(text);
  return isFinite(number) ? String(number) : text;
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
  const studentRow = getMonthlyStudentRowCached_(
    sheet,
    className,
    payload.studentSTT,
    payload.studentName
  );
  const lastColumn = sheet.getLastColumn();
  if (sheet.getLastRow() < ATTENDANCE_SUBJECT_ROW || lastColumn < ATTENDANCE_FIRST_COLUMN) {
    throw new Error('Sheet ' + sheet.getName() + ' chưa đúng cấu trúc điểm danh.');
  }
  const width = lastColumn - ATTENDANCE_FIRST_COLUMN + 1;
  const headerRange = sheet.getRange(
    ATTENDANCE_DATE_ROW,
    ATTENDANCE_FIRST_COLUMN,
    ATTENDANCE_SUBJECT_ROW - ATTENDANCE_DATE_ROW + 1,
    width
  );
  const headerDisplay = headerRange.getDisplayValues();
  const studentMarks = lastColumn >= ATTENDANCE_FIRST_COLUMN
    ? sheet.getRange(studentRow, ATTENDANCE_FIRST_COLUMN, 1, width).getDisplayValues()[0]
    : [];
  const subjectRowIndex = ATTENDANCE_SUBJECT_ROW - ATTENDANCE_DATE_ROW;
  const wantedSubject = normalizeVietnameseText_(subject);
  let excused = 0;
  let absent = 0;

  for (let column = ATTENDANCE_FIRST_COLUMN; column <= lastColumn; column++) {
    const offset = column - ATTENDANCE_FIRST_COLUMN;
    const columnSubject = normalizeVietnameseText_((headerDisplay[subjectRowIndex] || [])[offset]);
    if (columnSubject !== wantedSubject) continue;
    const mark = String(studentMarks[offset] || '').trim().toUpperCase();
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

/** Ngày tham chiếu thuộc năm học nào: tháng 8 năm trước đến hết tháng 7 năm sau. */
function getAcademicYearStartYear_(referenceDate) {
  const date = referenceDate instanceof Date && !isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  return date.getMonth() + 1 >= 8 ? date.getFullYear() : date.getFullYear() - 1;
}

function parseReferenceDateOrToday_(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const parts = text.split('-').map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (
      date.getFullYear() === parts[0] &&
      date.getMonth() === parts[1] - 1 &&
      date.getDate() === parts[2]
    ) return date;
  }
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

/**
 * Đọc đúng các dòng 5–8 của 12 sheet tháng và tính theo thứ tự năm học
 * Tháng 8→12, rồi Tháng 1→7. Mỗi cột chỉ được gán cho môn có tên khớp
 * chính xác sau khi chuẩn hóa.
 */
function buildSubjectProgressState_(ss, referenceDate, subjectDetails) {
  const schoolYearStart = getAcademicYearStartYear_(referenceDate);
  const state = { schoolYearStart: schoolYearStart, subjects: {} };

  (subjectDetails || []).forEach(function(detail) {
    const name = String(detail.TenMH || '').trim();
    const key = normalizeVietnameseText_(name);
    if (!key) return;
    if (state.subjects[key]) {
      throw new Error('DanhSachMH có tên môn bị trùng: ' + name + '.');
    }
    state.subjects[key] = {
      name: name,
      row: Number(detail._Row) || 0,
      subjectColumn: Number(detail._SubjectColumn) || 0,
      startDateColumn: Number(detail._StartDateColumn) || SUBJECT_START_DATE_COLUMN,
      progressColumn: Number(detail._ProgressColumn) || SUBJECT_PROGRESS_COLUMN,
      TongSoGio: String(detail.TongSoGio || '').trim(),
      StoredNgayBatDau: String(detail.NgayBatDau || '').trim(),
      StoredTienDo: String(detail.TienDo || '0').trim(),
      NgayBatDau: '',
      TienDo: '0',
      sessions: {}
    };
  });

  const academicStart = new Date(schoolYearStart, 7, 1);
  const academicEnd = new Date(schoolYearStart + 1, 7, 1);

  // Cấu trúc cố định của bảng điểm danh:
  // - Dòng 5: ngày; dòng 8: môn học.
  // - E/F: sáng/chiều của ngày đầu; G/H: ngày kế tiếp...
  // Duyệt đúng thứ tự năm học. Môn nào xuất hiện lần đầu thì ngày tại cặp cột
  // đó chính là NgayBatDau của môn, không suy đoán từ dòng hoặc ô khác.
  ACADEMIC_MONTH_ORDER.forEach(function(month) {
    const monthSheet = findMonthSheetOptional_(ss, month);
    if (
      !monthSheet || monthSheet.getLastRow() < ATTENDANCE_SUBJECT_ROW ||
      monthSheet.getLastColumn() < ATTENDANCE_FIRST_COLUMN
    ) return;

    const expectedYear = month >= 8 ? schoolYearStart : schoolYearStart + 1;
    const width = monthSheet.getLastColumn() - ATTENDANCE_FIRST_COLUMN + 1;
    const headerRange = monthSheet.getRange(
      ATTENDANCE_DATE_ROW,
      ATTENDANCE_FIRST_COLUMN,
      ATTENDANCE_SUBJECT_ROW - ATTENDANCE_DATE_ROW + 1,
      width
    );
    const raw = headerRange.getValues();
    const display = headerRange.getDisplayValues();
    const dateRowIndex = 0;
    const subjectRowIndex = ATTENDANCE_SUBJECT_ROW - ATTENDANCE_DATE_ROW;

    for (let pairOffset = 0; pairOffset < width; pairOffset += 2) {
      let attendanceDate = parseAttendanceDate_(
        (raw[dateRowIndex] || [])[pairOffset],
        (display[dateRowIndex] || [])[pairOffset],
        month,
        expectedYear
      );
      // Dự phòng nếu ngày không nằm ở ô đầu cặp do dữ liệu cũ chưa gộp E/F.
      if (!attendanceDate && pairOffset + 1 < width) {
        attendanceDate = parseAttendanceDate_(
          (raw[dateRowIndex] || [])[pairOffset + 1],
          (display[dateRowIndex] || [])[pairOffset + 1],
          month,
          expectedYear
        );
      }
      if (!attendanceDate || attendanceDate < academicStart || attendanceDate >= academicEnd) continue;
      if (attendanceDate.getMonth() + 1 !== month || attendanceDate.getFullYear() !== expectedYear) continue;

      for (let sessionOffset = 0; sessionOffset <= 1; sessionOffset++) {
        const cellOffset = pairOffset + sessionOffset;
        if (cellOffset >= width) continue;
        const subjectName = String((display[subjectRowIndex] || [])[cellOffset] || '').trim();
        const subjectKey = normalizeVietnameseText_(subjectName);
        const subject = state.subjects[subjectKey];
        if (!subject) continue;
        const session = sessionOffset === 0 ? 'S' : 'C';
        const sessionKey = formatDateKey_(attendanceDate) + '|' + session;
        subject.sessions[sessionKey] = true;
        if (!subject.NgayBatDau) {
          subject.NgayBatDau = formatDateKeyForDisplay_(formatDateKey_(attendanceDate));
        }
      }
    }
  });

  Object.keys(state.subjects).forEach(function(key) {
    const item = state.subjects[key];
    const sessionKeys = Object.keys(item.sessions);
    item.TienDo = String(sessionKeys.length * HOURS_PER_SESSION);
    if (!sessionKeys.length) item.NgayBatDau = '';
  });
  return state;
}

function formatDateKeyForDisplay_(dateKey) {
  const parts = String(dateKey || '').split('-');
  return parts.length === 3 ? [parts[2], parts[1], parts[0]].join('/') : '';
}

/** Tính lại một năm học; chỉ ghi các ô H/I có giá trị thực sự thay đổi. */
function rebuildSubjectProgress_(ss, className, referenceDate, writeChanges) {
  const details = getSubjectDetails_(ss, 'DanhSachMH');
  const state = buildSubjectProgressState_(ss, referenceDate, details);
  if (writeChanges) writeSubjectStateChanges_(ss, state);
  writeSubjectCache_(className, state);
  return state;
}

function writeSubjectStateChanges_(ss, state) {
  const sheet = requireSheet_(ss, 'DanhSachMH');
  let changed = false;
  Object.keys(state.subjects || {}).forEach(function(key) {
    const item = state.subjects[key];
    if (!item.row) return;
    const storedDateKey = normalizedDateKey_(item.StoredNgayBatDau);
    const wantedDateKey = normalizedDateKey_(item.NgayBatDau);
    if (storedDateKey !== wantedDateKey) {
      const value = wantedDateKey
        ? parseReferenceDateOrToday_(wantedDateKey)
        : '';
      const dateRange = sheet.getRange(item.row, item.startDateColumn);
      dateRange.setValue(value);
      if (wantedDateKey) dateRange.setNumberFormat('dd/MM/yyyy');
      item.StoredNgayBatDau = item.NgayBatDau;
      changed = true;
    }
    const storedHours = Number(String(item.StoredTienDo || '0').replace(',', '.')) || 0;
    const wantedHours = Number(String(item.TienDo || '0').replace(',', '.')) || 0;
    if (storedHours !== wantedHours) {
      sheet.getRange(item.row, item.progressColumn).setValue(wantedHours).setNumberFormat('0');
      item.StoredTienDo = String(wantedHours);
      changed = true;
    }
  });
  return changed;
}

function normalizedDateKey_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (!match) return '';
  const year = Number(match[3].length === 2 ? '20' + match[3] : match[3]);
  const month = Number(match[2]);
  const day = Number(match[1]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return '';
  return formatDateKey_(date);
}

/**
 * Dùng dữ liệu H/I đã nạp trên trình duyệt cho đường lưu nhanh. Chỉ chấp nhận
 * snapshot của đúng môn và đúng năm học; H/I lệch nhau sẽ buộc đồng bộ lại.
 */
function getFastSubjectSnapshot_(subjectName, targetDate, snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const wantedSubject = normalizeVietnameseText_(subjectName);
  if (!wantedSubject || normalizeVietnameseText_(snapshot.TenMH) !== wantedSubject) return null;
  const schoolYearStart = getAcademicYearStartYear_(targetDate);
  if (Number(snapshot.schoolYearStart) !== schoolYearStart) return null;

  const currentDate = String(snapshot.NgayBatDau || '').trim();
  const storedDate = String(snapshot.StoredNgayBatDau || '').trim();
  const currentHours = Number(String(snapshot.TienDo || '0').replace(',', '.')) || 0;
  const storedHours = Number(String(snapshot.StoredTienDo || '0').replace(',', '.')) || 0;
  const currentDateKey = normalizedDateKey_(currentDate);
  const storedDateKey = normalizedDateKey_(storedDate);
  return {
    NgayBatDau: currentDate,
    TienDo: String(currentHours),
    StoredNgayBatDau: storedDate,
    StoredTienDo: String(storedHours),
    schoolYearStart: schoolYearStart,
    needsSync: !currentDateKey || currentDateKey !== storedDateKey || currentHours !== storedHours
  };
}

/**
 * Cập nhật nhanh đúng một môn. Không đọc lại DanhSachMH: vị trí dòng, ngày bắt
 * đầu và tiến độ đã có từ lúc chọn lớp hoặc từ subjectSnapshot của trình duyệt.
 */
function updateSubjectProgressAfterAttendance_(
  ss,
  className,
  subject,
  targetDate,
  sessionAlreadyCounted,
  subjectSnapshot
) {
  const subjectName = String(subject || '').trim();
  if (!subjectName) return { NgayBatDau: '', TienDo: '0' };

  const resolved = resolveCachedSubject_(
    ss,
    className,
    subjectName,
    targetDate,
    subjectSnapshot,
    true
  );
  const item = resolved.item;
  if (!item || Number(item.row) < 2) return { NgayBatDau: '', TienDo: '0' };

  const originalStartDateText = String(item.NgayBatDau || '').trim();
  const originalHours = Number(String(item.TienDo || '0').replace(',', '.')) || 0;
  let startDateText = originalStartDateText;
  const existingStartDate = parseAttendanceDate_(
    '',
    startDateText,
    targetDate.getMonth() + 1,
    targetDate.getFullYear()
  );
  if (!existingStartDate || targetDate < existingStartDate) {
    startDateText = Utilities.formatDate(
      targetDate,
      ss.getSpreadsheetTimeZone() || 'Asia/Ho_Chi_Minh',
      'dd/MM/yyyy'
    );
  }

  let currentHours = originalHours;
  if (!sessionAlreadyCounted) {
    currentHours += HOURS_PER_SESSION;
  }

  item.NgayBatDau = startDateText;
  item.TienDo = String(currentHours);
  const oneSubjectState = { subjects: {} };
  oneSubjectState.subjects[resolved.key] = item;
  const sheetChanged = writeSubjectStateChanges_(ss, oneSubjectState);
  const stateChanged = normalizedDateKey_(originalStartDateText) !== normalizedDateKey_(startDateText) ||
    originalHours !== currentHours;
  if (sheetChanged || stateChanged) writeSubjectCache_(className, resolved.state);
  return {
    NgayBatDau: startDateText,
    TienDo: String(currentHours)
  };
}

function parseAttendanceDate_(rawValue, displayValue, defaultMonth, defaultYear) {
  if (Object.prototype.toString.call(rawValue) === '[object Date]' && !isNaN(rawValue.getTime())) {
    return new Date(rawValue.getFullYear(), rawValue.getMonth(), rawValue.getDate());
  }

  const text = String(displayValue || '').trim();
  if (!text) return null;
  let day;
  let month = Number(defaultMonth);
  let year = Number(defaultYear);
  const fullMatch = text.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2}|\d{4}))?$/);
  if (fullMatch) {
    day = Number(fullMatch[1]);
    month = Number(fullMatch[2]);
    if (fullMatch[3]) year = Number(fullMatch[3].length === 2 ? '20' + fullMatch[3] : fullMatch[3]);
  } else if (/^\d{1,2}$/.test(text)) {
    day = Number(text);
  } else {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function formatDateKey_(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function findMonthSheet_(ss, month) {
  const sheet = findMonthSheetOptional_(ss, month);
  if (!sheet) throw new Error('Không tìm thấy sheet Tháng ' + month + ' trong file ' + ss.getName() + '.');
  return sheet;
}

function findMonthSheetOptional_(ss, month) {
  const wanted = 'thang' + Number(month);
  return ss.getSheets().find(function(item) {
    return normalizeHeader_(item.getName()) === wanted;
  }) || null;
}

function findAttendanceColumnByLayout_(raw, display, targetDate, session) {
  const width = display[0] ? display[0].length : 0;
  const dateRowIndex = 0;
  const sessionRowIndex = ATTENDANCE_SESSION_ROW - ATTENDANCE_DATE_ROW;
  const sessionOffset = session === 'C' ? 1 : 0;
  for (let pairOffset = 0; pairOffset < width; pairOffset += 2) {
    const rawDate = (raw[dateRowIndex] || [])[pairOffset];
    const displayDate = (display[dateRowIndex] || [])[pairOffset];
    if (!headerDateMatches_(rawDate, displayDate, targetDate, targetDate.getDate())) continue;
    const cellOffset = pairOffset + sessionOffset;
    if (cellOffset >= width) break;
    const writtenSession = normalizeSession_((display[sessionRowIndex] || [])[cellOffset]);
    if (writtenSession && writtenSession !== session) continue;
    return {
      column: ATTENDANCE_FIRST_COLUMN + cellOffset,
      sessionRow: ATTENDANCE_SESSION_ROW
    };
  }

  throw new Error(
    'Không tìm thấy cột ngày ' + Utilities.formatDate(targetDate, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy') +
    ', buổi ' + session + ' theo cấu trúc dòng 5–8 của sheet tháng.'
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
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return [];

  // Chỉ đọc dòng tiêu đề và đúng một cột dữ liệu, tránh getDataRange() kéo theo
  // hàng/cột trống đã từng được định dạng trong DanhSachGV.
  const headers = sheet.getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(normalizeHeader_);
  let column = findHeaderColumn_(headers, possibleHeaders);
  if (column === -1) column = Math.min(1, lastColumn - 1); // Cấu trúc hiện tại dùng cột B.

  const values = sheet.getRange(2, column + 1, lastRow - 1, 1).getDisplayValues();

  const result = [];
  for (let row = 0; row < values.length; row++) {
    const value = String(values[row][0] || '').trim();
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
 *   NgayBatDau
 *   TienDo
 *   DanhSachMH
 *   ThucHanh
 *   Thi
 *
 * Hàm chỉ ĐỌC dữ liệu, không thay đổi sheet.
 */
function getSubjectDetails_(ss, sheetName) {
  const sheet = requireSheet_(ss, sheetName);
  const range = sheet.getDataRange();
  const rawValues = range.getValues();
  const values = range.getDisplayValues();

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

    NgayBatDau: col([
      'ngaybatdau'
    ]),

    TienDo: col([
      'tiendo'
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
  if (columns.NgayBatDau === -1 || columns.TienDo === -1) {
    throw new Error('Sheet DanhSachMH chưa có đủ cột NgayBatDau và TienDo.');
  }

  const result = [];
  const timezone = ss.getSpreadsheetTimeZone() || 'Asia/Ho_Chi_Minh';

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const tenMH = cell_(row, columns.TenMH);

    // Bỏ qua dòng trống.
    if (!tenMH) {
      continue;
    }

    result.push({
      _Row: r + 1,
      _SubjectColumn: columns.TenMH + 1,
      _StartDateColumn: columns.NgayBatDau + 1,
      _ProgressColumn: columns.TienDo + 1,
      TenMH: tenMH,
      HocKy: cell_(row, columns.HocKy),
      TongSoGio: cell_(row, columns.TongSoGio),
      NgayBatDau: dateCell_(rawValues[r], row, columns.NgayBatDau, timezone),
      TienDo: cell_(row, columns.TienDo),
      DanhSachMH: cell_(row, columns.DanhSachMH),
      ThucHanh: cell_(row, columns.ThucHanh),
      Thi: cell_(row, columns.Thi)
    });
  }

  return result;
}

function getStudentList_(ss, className, checkPhotoExists) {
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
    Vector1: findHeaderColumn_(headers, ['vector1']),
    Vector2: findHeaderColumn_(headers, ['vector2']),
    Vector3: findHeaderColumn_(headers, ['vector3']),
    Vector4: findHeaderColumn_(headers, ['vector4']),
    Vector5: findHeaderColumn_(headers, ['vector5']),
    NgayCapNhat: findHeaderColumn_(headers, ['ngaycapnhat']),
    TrangThai: findHeaderColumn_(headers, ['trangthai'])
  };

  if (columns.STT === -1) throw new Error('Sheet DanhSachHS không có cột STT.');
  if (columns.HoVaTen === -1) throw new Error('Sheet DanhSachHS không có cột HoVaTen.');

  const timezone = ss.getSpreadsheetTimeZone() || 'Asia/Ho_Chi_Minh';
  const students = [];
  for (let row = 1; row < displayValues.length; row++) {
    const name = cell_(displayValues[row], columns.HoVaTen);
    if (!name) continue;

    let linkAnh = cell_(displayValues[row], columns.LinkAnh);
    // Chỉ mục Ảnh đại diện mới kiểm tra Drive. Trang Điểm danh bỏ qua bước này
    // để tải nhanh; ảnh hỏng trên giao diện sẽ tự quay về chữ viết tắt.
    if (checkPhotoExists && linkAnh && !studentPhotoExists_(linkAnh)) {
      if (columns.LinkAnh !== -1) sheet.getRange(row + 1, columns.LinkAnh + 1).clearContent();
      linkAnh = '';
    }
    const vectors = [
      cell_(displayValues[row], columns.Vector1),
      cell_(displayValues[row], columns.Vector2),
      cell_(displayValues[row], columns.Vector3),
      cell_(displayValues[row], columns.Vector4),
      cell_(displayValues[row], columns.Vector5)
    ];
    const ngayCapNhat = dateTimeCell_(
      rawValues[row],
      displayValues[row],
      columns.NgayCapNhat,
      timezone
    );
    const trangThaiTrongSheet = cell_(displayValues[row], columns.TrangThai);
    // Trạng thái đăng ký chỉ căn cứ vào cột TrangThai theo quy ước quản lý.
    const daDangKy = normalizeVietnameseText_(trangThaiTrongSheet) === 'da dang ky';

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
      LinkAnh: linkAnh,
      Vector1: vectors[0],
      Vector2: vectors[1],
      Vector3: vectors[2],
      Vector4: vectors[3],
      Vector5: vectors[4],
      NgayCapNhat: ngayCapNhat,
      TrangThai: trangThaiTrongSheet || 'Chưa đăng ký',
      DaDangKy: daDangKy
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

/** Định dạng thời điểm cập nhật; ô trống được giữ nguyên để nhận biết chưa đăng ký. */
function dateTimeCell_(rawRow, displayRow, column, timezone) {
  if (column === -1) return '';
  const raw = rawRow[column];
  if (Object.prototype.toString.call(raw) === '[object Date]' && !isNaN(raw.getTime())) {
    return Utilities.formatDate(raw, timezone, 'dd/MM/yyyy HH:mm:ss');
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

