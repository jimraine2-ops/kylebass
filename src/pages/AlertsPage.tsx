import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bell, Trash2, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";

interface Alert {
  id: string;
  symbol: string;
  condition: string;
  value: number;
  active: boolean;
  createdAt: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>(() => {
    const saved = localStorage.getItem('stock-alerts');
    return saved ? JSON.parse(saved) : [];
  });
  const [symbol, setSymbol] = useState('');
  const [condition, setCondition] = useState('price_above');
  const [value, setValue] = useState('');

  useEffect(() => {
    localStorage.setItem('stock-alerts', JSON.stringify(alerts));
  }, [alerts]);

  const addAlert = () => {
    if (!symbol || !value) return;
    const newAlert: Alert = {
      id: Date.now().toString(),
      symbol: symbol.toUpperCase(),
      condition,
      value: parseFloat(value),
      active: true,
      createdAt: new Date().toISOString(),
    };
    setAlerts(prev => [newAlert, ...prev]);
    setSymbol('');
    setValue('');

    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    toast({ title: "알림 추가됨", description: `${newAlert.symbol} 알림이 설정되었습니다.` });
  };

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const conditionLabels: Record<string, string> = {
    price_above: '가격이 이상일 때',
    price_below: '가격이 이하일 때',
    rsi_above: 'RSI가 이상일 때',
    rsi_below: 'RSI가 이하일 때',
    volume_spike: '거래량 급증 시 (배수)',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Bell className="w-6 h-6 text-primary" />
        알림 설정
      </h1>

      {/* Create Alert */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">새 알림 추가</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">종목 심볼</Label>
              <Input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="AAPL" className="mt-1 font-mono" />
            </div>
            <div>
              <Label className="text-xs">조건</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="price_above">가격 이상</SelectItem>
                  <SelectItem value="price_below">가격 이하</SelectItem>
                  <SelectItem value="rsi_above">RSI 이상</SelectItem>
                  <SelectItem value="rsi_below">RSI 이하</SelectItem>
                  <SelectItem value="volume_spike">거래량 급증</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">값</Label>
              <Input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="0" className="mt-1 font-mono" />
            </div>
            <div className="flex items-end">
              <Button onClick={addAlert} className="w-full gap-2">
                <Plus className="w-4 h-4" /> 추가
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Alerts */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">활성 알림 ({alerts.length})</CardTitle></CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">설정된 알림이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map(alert => (
                <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono font-bold">{alert.symbol}</Badge>
                    <span className="text-sm">{conditionLabels[alert.condition]}</span>
                    <span className="text-sm font-mono font-bold">{alert.value}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeAlert(alert.id)}>
                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-stock-down" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
