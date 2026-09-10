import { useState } from 'react';
import { useTriggerBackup, useBackupHistory, useOpenBackupFolder, useNextBackupTime, useAutoBackup } from '@/hooks/useAutoBackup';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertCircle, Download, Folder, History, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const isElectron = !!(window as any).electronEnv?.isElectron;

export function BackupPanel() {
  const { isScheduled } = useAutoBackup();
  const triggerBackup = useTriggerBackup();
  const { data: backupHistory } = useBackupHistory();
  const { data: nextBackupTime } = useNextBackupTime();
  const openBackupFolder = useOpenBackupFolder();
  const [showHistory, setShowHistory] = useState(false);

  const lastBackup = backupHistory?.[0];

  // Format next backup time — only meaningful inside Electron
  let formattedNextTime: string | null = null;
  if (!isElectron) {
    formattedNextTime = 'Desktop app only';
  } else if (nextBackupTime) {
    formattedNextTime = format(new Date(nextBackupTime), 'yyyy-MM-dd HH:mm:ss');
  } else {
    formattedNextTime = null; // still loading
  }

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-600" />
              Auto Backup
            </CardTitle>
            <CardDescription>Daily invoices backup at midnight</CardDescription>
          </div>
          {isScheduled && (
            <Badge className="bg-green-500 hover:bg-green-600">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Active
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Section */}
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Clock className="w-4 h-4 mt-1 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">Next Backup</p>
              <p className="text-sm text-gray-600">
                {formattedNextTime ?? 'Scheduled for midnight…'}
              </p>
            </div>
          </div>

          {lastBackup && (
            <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle2 className="w-4 h-4 mt-1 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Last Backup</p>
                <p className="text-sm text-gray-600">{lastBackup.date}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {(lastBackup.size / 1024).toFixed(2)} KB • {lastBackup.filename}
                </p>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={() => triggerBackup.mutate()}
            disabled={triggerBackup.isPending || !isElectron}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            title={!isElectron ? 'Backup requires the desktop app' : undefined}
          >
            {triggerBackup.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Backing up...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Backup Now
              </>
            )}
          </Button>

          <Dialog open={showHistory} onOpenChange={setShowHistory}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1">
                <History className="w-4 h-4 mr-2" />
                History
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Backup History</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {backupHistory && backupHistory.length > 0 ? (
                  backupHistory.map((backup: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{backup.filename}</p>
                        <p className="text-xs text-gray-500">{backup.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-700">
                          {(backup.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No backups yet</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Button
            onClick={openBackupFolder}
            variant="outline"
            className="flex-1"
            disabled={!isElectron}
            title={!isElectron ? 'Only available in the desktop app' : undefined}
          >
            <Folder className="w-4 h-4 mr-2" />
            Open Folder
          </Button>
        </div>

        {/* Info Text */}
        <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
          {isElectron
            ? '💡 Backups are saved locally in your Backups folder. Daily automatic backup occurs at midnight. You can manually backup anytime.'
            : '💡 Automatic & manual backups are only available in the desktop (Electron) app.'}
        </p>
      </CardContent>
    </Card>
  );
}
