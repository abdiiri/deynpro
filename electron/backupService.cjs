/**
 * Backup Service for DeynPro
 * Handles automatic and manual backups of invoices to Excel
 * Auto-schedules backup for midnight every day
 */

const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const XLSX = require('xlsx');
const { format, startOfDay, addDays, isSameDay } = require('date-fns');
const db = require('./db.cjs');

// Backup folder location
const BACKUP_DIR = path.join(app.getPath('userData'), 'Backups');

// Create backups directory if it doesn't exist
function createBackupDirectory() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log('Backup directory created:', BACKUP_DIR);
  }
}

// Get today's sales from database
function getTodaysSales(userId) {
  try {
    const allSales = db.select('sales', {});
    const today = startOfDay(new Date());
    
    const todaysSales = (allSales || []).filter(sale => {
      if (sale.deleted_at) return false;
      const saleDate = startOfDay(new Date(sale.date));
      return isSameDay(saleDate, today);
    });

    console.log(`Found ${todaysSales.length} sales for today`);
    return todaysSales;
  } catch (error) {
    console.error('Error getting today\'s sales:', error);
    throw error;
  }
}

// Get all sale items for given sales
function getSaleItems(saleIds) {
  try {
    const allItems = db.select('sale_items', {});
    return (allItems || []).filter(item => saleIds.includes(item.sale_id));
  } catch (error) {
    console.error('Error getting sale items:', error);
    return [];
  }
}

// Get product details
function getProducts() {
  try {
    return db.select('products', {}) || [];
  } catch (error) {
    console.error('Error getting products:', error);
    return [];
  }
}

// Get customer details
function getCustomers() {
  try {
    return db.select('customers', {}) || [];
  } catch (error) {
    console.error('Error getting customers:', error);
    return [];
  }
}

// Export today's invoices to Excel
function exportTodayInvoices(userId) {
  try {
    createBackupDirectory();

    // Get data
    const todaysSales = getTodaysSales(userId);
    const saleIds = todaysSales.map(s => s.id);
    const saleItems = getSaleItems(saleIds);
    const products = getProducts();
    const customers = getCustomers();

    // Create lookup maps
    const productMap = {};
    products.forEach(p => {
      productMap[p.id] = p;
    });

    const customerMap = {};
    customers.forEach(c => {
      customerMap[c.id] = c;
    });

    // Sheet 1: Invoices Summary
    const invoicesSheet = todaysSales.map((sale, idx) => ({
      'Invoice #': `INV-${format(new Date(sale.date), 'yyyyMMdd')}-${String(idx + 1).padStart(4, '0')}`,
      'Date': format(new Date(sale.date), 'yyyy-MM-dd HH:mm'),
      'Customer': customerMap[sale.customer_id]?.name || 'N/A',
      'Items Count': saleItems.filter(si => si.sale_id === sale.id).length,
      'Total Amount': sale.total_amount,
      'Payment Method': sale.payment_method,
    }));

    // Sheet 2: Detailed Items
    const itemsSheet = [];
    todaysSales.forEach((sale, saleIdx) => {
      const items = saleItems.filter(si => si.sale_id === sale.id);
      items.forEach(item => {
        itemsSheet.push({
          'Invoice #': `INV-${format(new Date(sale.date), 'yyyyMMdd')}-${String(saleIdx + 1).padStart(4, '0')}`,
          'Product': productMap[item.product_id]?.name || 'Unknown',
          'Quantity': item.quantity,
          'Unit Price': item.unit_price,
          'Subtotal': item.subtotal,
        });
      });
    });

    // Sheet 3: Summary Statistics
    const totalAmount = todaysSales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const totalItems = itemsSheet.reduce((sum, item) => sum + item.Quantity, 0);
    const summarySheet = [
      { Metric: 'Total Invoices', Value: todaysSales.length },
      { Metric: 'Total Items Sold', Value: totalItems },
      { Metric: 'Total Revenue', Value: totalAmount },
      { Metric: 'Average Invoice Value', Value: todaysSales.length > 0 ? (totalAmount / todaysSales.length).toFixed(2) : 0 },
      { Metric: 'Backup Date', Value: format(new Date(), 'yyyy-MM-dd HH:mm:ss') },
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    const ws1 = XLSX.utils.json_to_sheet(invoicesSheet.length > 0 ? invoicesSheet : [{ Info: 'No invoices today' }]);
    XLSX.utils.book_append_sheet(wb, ws1, 'Invoices');
    
    const ws2 = XLSX.utils.json_to_sheet(itemsSheet.length > 0 ? itemsSheet : [{ Info: 'No items' }]);
    XLSX.utils.book_append_sheet(wb, ws2, 'Items');
    
    const ws3 = XLSX.utils.json_to_sheet(summarySheet);
    XLSX.utils.book_append_sheet(wb, ws3, 'Summary');

    // Generate filename with today's date
    const filename = `${format(new Date(), 'yyyy-MM-dd')}_invoices.xlsx`;
    const filepath = path.join(BACKUP_DIR, filename);

    // Save file
    XLSX.writeFile(wb, filepath);

    console.log('Backup created successfully:', filepath);
    return {
      success: true,
      filename,
      filepath,
      invoiceCount: todaysSales.length,
      itemCount: itemsSheet.length,
      totalAmount,
    };
  } catch (error) {
    console.error('Error exporting invoices:', error);
    throw error;
  }
}

// Get backup history
function getBackupHistory() {
  try {
    createBackupDirectory();

    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.xlsx'))
      .map(filename => {
        const filepath = path.join(BACKUP_DIR, filename);
        const stats = fs.statSync(filepath);
        return {
          filename,
          filepath,
          size: stats.size,
          created: stats.mtimeMs,
          date: format(new Date(stats.mtimeMs), 'yyyy-MM-dd HH:mm:ss'),
        };
      })
      .sort((a, b) => b.created - a.created);

    return files;
  } catch (error) {
    console.error('Error getting backup history:', error);
    return [];
  }
}

// Open backups folder in file explorer
function openBackupFolder() {
  try {
    createBackupDirectory();
    const { shell } = require('electron');
    shell.openPath(BACKUP_DIR);
  } catch (error) {
    console.error('Error opening backup folder:', error);
    throw error;
  }
}

// Calculate next midnight
function getNextMidnight() {
  const now = new Date();
  const tomorrow = addDays(startOfDay(now), 1);
  return tomorrow;
}

// Check if backup was missed (e.g. app was closed at midnight)
// If today's backup file doesn't exist yet and it's past midnight, run it now
function runMissedBackupCheck(userId) {
  try {
    createBackupDirectory();
    const todayFilename = `${format(new Date(), 'yyyy-MM-dd')}_invoices.xlsx`;
    const todayFilepath = path.join(BACKUP_DIR, todayFilename);
    if (!fs.existsSync(todayFilepath)) {
      console.log('[Backup] No backup found for today — running missed backup check...');
      const result = exportTodayInvoices(userId);
      console.log('[Backup] Missed backup completed:', result.filename);
    } else {
      console.log('[Backup] Today backup already exists:', todayFilename);
    }
  } catch (error) {
    console.error('[Backup] Missed backup check failed:', error.message);
  }
}

// Schedule backup for midnight
let backupScheduler = null;

function scheduleBackup(userId) {
  if (backupScheduler) {
    clearTimeout(backupScheduler);
  }

  const now = new Date();
  const nextMidnight = getNextMidnight();
  const timeUntilMidnight = nextMidnight.getTime() - now.getTime();

  console.log(`Next backup scheduled for: ${format(nextMidnight, 'yyyy-MM-dd HH:mm:ss')}`);
  console.log(`Time until next backup: ${Math.floor(timeUntilMidnight / 1000 / 60)} minutes`);

  backupScheduler = setTimeout(() => {
    try {
      console.log('Running scheduled backup...');
      const result = exportTodayInvoices(userId);
      console.log('Scheduled backup completed:', result);
      
      // Reschedule for next midnight
      scheduleBackup(userId);
    } catch (error) {
      console.error('Scheduled backup failed:', error);
      // Retry in 1 hour
      setTimeout(() => scheduleBackup(userId), 1000 * 60 * 60);
    }
  }, timeUntilMidnight);
}

// Cancel scheduled backup
function cancelBackup() {
  if (backupScheduler) {
    clearTimeout(backupScheduler);
    backupScheduler = null;
    console.log('Backup scheduler cancelled');
  }
}

module.exports = {
  createBackupDirectory,
  exportTodayInvoices,
  getBackupHistory,
  openBackupFolder,
  scheduleBackup,
  cancelBackup,
  getNextMidnight,
  runMissedBackupCheck,
};
