import type { ConnectionAdapter, ConnectionTestResult, ExecuteResult, ConfigField, ConnectionOperation } from "../core/types.js";

const USB_CONFIG: ConfigField[] = [
  { key: "vendorId", label: "Vendor ID", type: "string", required: false, placeholder: "0x1234" },
  { key: "productId", label: "Product ID", type: "string", required: false, placeholder: "0x5678" },
  { key: "endpoint", label: "Endpoint", type: "number", required: false },
];

class USBAdapter implements ConnectionAdapter {
  name = "usb"; displayName = "USB"; category = "hardware" as const;
  description = "Universal Serial Bus device communication"; icon = "🔌";
  authType = "none" as const;
  configSchema: ConfigField[] = USB_CONFIG;
  async testConnection(config: Record<string, unknown>) {
    const c = config as any;
    if (c.vendorId) return { success: true, latency: 1, message: `USB device configured (VID: ${c.vendorId})` };
    return { success: false, latency: 0, message: "No USB device configured" };
  }
  async execute(_op: string, _config: Record<string, unknown>, payload?: unknown) {
    return { success: true, data: { message: "USB execute (simulated)", payload }, duration: 1 };
  }
  getOperations(): ConnectionOperation[] { return [
    { id: "list-devices", name: "List Devices", description: "List connected USB devices", inputSchema: [], outputSchema: [] },
    { id: "send-data", name: "Send Data", description: "Send data to USB device", inputSchema: [], outputSchema: [] },
  ]; }
}

class BluetoothAdapter implements ConnectionAdapter {
  name = "bluetooth"; displayName = "Bluetooth"; category = "hardware" as const;
  description = "Classic Bluetooth device communication"; icon = "📶";
  authType = "none" as const;
  configSchema: ConfigField[] = [
    { key: "deviceAddress", label: "Device Address", type: "string", required: false, placeholder: "00:11:22:33:44:55" },
    { key: "channel", label: "Channel", type: "number", required: false, defaultValue: 1 },
  ];
  async testConnection() { return { success: true, latency: 1, message: "Bluetooth adapter ready" }; }
  async execute() { return { success: true, data: { message: "Bluetooth execute (simulated)" }, duration: 1 }; }
  getOperations(): ConnectionOperation[] { return [
    { id: "scan", name: "Scan Devices", description: "Scan for nearby Bluetooth devices", inputSchema: [], outputSchema: [] },
    { id: "send", name: "Send Data", description: "Send data over Bluetooth", inputSchema: [], outputSchema: [] },
  ]; }
}

class BLEAdapter implements ConnectionAdapter {
  name = "ble"; displayName = "Bluetooth LE"; category = "hardware" as const;
  description = "Bluetooth Low Energy communication"; icon = "📶";
  authType = "none" as const;
  configSchema: ConfigField[] = [
    { key: "serviceUuid", label: "Service UUID", type: "string", required: false },
    { key: "characteristicUuid", label: "Characteristic UUID", type: "string", required: false },
  ];
  async testConnection() { return { success: true, latency: 1, message: "BLE adapter ready" }; }
  async execute() { return { success: true, data: { message: "BLE execute (simulated)" }, duration: 1 }; }
  getOperations(): ConnectionOperation[] { return [
    { id: "scan", name: "Scan Peripherals", description: "Scan for BLE peripherals", inputSchema: [], outputSchema: [] },
    { id: "read-characteristic", name: "Read Characteristic", description: "Read from a BLE characteristic", inputSchema: [], outputSchema: [] },
    { id: "write-characteristic", name: "Write Characteristic", description: "Write to a BLE characteristic", inputSchema: [], outputSchema: [] },
  ]; }
}

class SerialAdapter implements ConnectionAdapter {
  name = "serial"; displayName = "Serial Port"; category = "hardware" as const;
  description = "RS-232 serial port communication"; icon = "🔌";
  authType = "none" as const;
  configSchema: ConfigField[] = [
    { key: "port", label: "Port Name", type: "string", required: true, placeholder: "COM3 or /dev/ttyUSB0" },
    { key: "baudRate", label: "Baud Rate", type: "number", required: false, defaultValue: 9600 },
    { key: "dataBits", label: "Data Bits", type: "number", required: false, defaultValue: 8 },
    { key: "parity", label: "Parity", type: "select", required: false, defaultValue: "none", options: [{ label: "None", value: "none" }, { label: "Even", value: "even" }, { label: "Odd", value: "odd" }] },
    { key: "stopBits", label: "Stop Bits", type: "number", required: false, defaultValue: 1 },
  ];
  async testConnection(config: Record<string, unknown>) {
    const c = config as any;
    if (c.port) return { success: true, latency: 1, message: `Serial port ${c.port} configured at ${c.baudRate || 9600} baud` };
    return { success: false, latency: 0, message: "No serial port configured" };
  }
  async execute(_op: string, config: Record<string, unknown>, payload?: unknown) {
    return { success: true, data: { port: (config as any).port, payload, message: "Serial execute (simulated)" }, duration: 1 };
  }
  getOperations(): ConnectionOperation[] { return [
    { id: "list-ports", name: "List Ports", description: "List available serial ports", inputSchema: [], outputSchema: [] },
    { id: "write", name: "Write", description: "Write data to serial port", inputSchema: [], outputSchema: [] },
    { id: "read", name: "Read", description: "Read data from serial port", inputSchema: [], outputSchema: [] },
  ]; }
}

class HIDAdapter implements ConnectionAdapter {
  name = "hid"; displayName = "HID"; category = "hardware" as const;
  description = "Human Interface Device protocol"; icon = "🖱️";
  authType = "none" as const;
  configSchema: ConfigField[] = [
    { key: "vendorId", label: "Vendor ID", type: "string", required: false, placeholder: "0x1234" },
    { key: "productId", label: "Product ID", type: "string", required: false, placeholder: "0x5678" },
    { key: "usagePage", label: "Usage Page", type: "number", required: false },
  ];
  async testConnection() { return { success: true, latency: 1, message: "HID adapter ready" }; }
  async execute() { return { success: true, data: { message: "HID execute (simulated)" }, duration: 1 }; }
  getOperations(): ConnectionOperation[] { return [
    { id: "list-devices", name: "List Devices", description: "List HID devices", inputSchema: [], outputSchema: [] },
    { id: "send-report", name: "Send Report", description: "Send HID report", inputSchema: [], outputSchema: [] },
    { id: "receive-report", name: "Receive Report", description: "Receive HID report", inputSchema: [], outputSchema: [] },
  ]; }
}

class WebUSBAdapter implements ConnectionAdapter {
  name = "webusb"; displayName = "WebUSB"; category = "hardware" as const;
  description = "WebUSB API for browser-based USB access"; icon = "🌐";
  authType = "none" as const;
  configSchema: ConfigField[] = [
    { key: "filters", label: "Device Filters", type: "json", required: false, placeholder: '[{"vendorId": 0x1234}]' },
  ];
  async testConnection() { return { success: true, latency: 1, message: "WebUSB adapter ready" }; }
  async execute() { return { success: true, data: { message: "WebUSB execute (simulated)" }, duration: 1 }; }
  getOperations(): ConnectionOperation[] { return [
    { id: "request-device", name: "Request Device", description: "Request USB device via browser prompt", inputSchema: [], outputSchema: [] },
    { id: "claim-interface", name: "Claim Interface", description: "Claim USB interface", inputSchema: [], outputSchema: [] },
    { id: "transfer", name: "Transfer", description: "USB bulk transfer", inputSchema: [], outputSchema: [] },
  ]; }
}

class WebBluetoothAdapter implements ConnectionAdapter {
  name = "webbluetooth"; displayName = "WebBluetooth"; category = "hardware" as const;
  description = "Web Bluetooth API for browser-based BLE"; icon = "🌐";
  authType = "none" as const;
  configSchema: ConfigField[] = [
    { key: "filters", label: "Device Filters", type: "json", required: false, placeholder: '[{"services": ["battery_service"]}]' },
    { key: "optionalServices", label: "Optional Services", type: "json", required: false },
  ];
  async testConnection() { return { success: true, latency: 1, message: "WebBluetooth adapter ready" }; }
  async execute() { return { success: true, data: { message: "WebBluetooth execute (simulated)" }, duration: 1 }; }
  getOperations(): ConnectionOperation[] { return [
    { id: "request-device", name: "Request Device", description: "Request BLE device via browser prompt", inputSchema: [], outputSchema: [] },
    { id: "connect", name: "Connect", description: "Connect to GATT server", inputSchema: [], outputSchema: [] },
    { id: "read", name: "Read", description: "Read characteristic value", inputSchema: [], outputSchema: [] },
    { id: "write", name: "Write", description: "Write characteristic value", inputSchema: [], outputSchema: [] },
  ]; }
}

export function registerAll(register: (adapter: ConnectionAdapter) => void): void {
  register(new USBAdapter());
  register(new BluetoothAdapter());
  register(new BLEAdapter());
  register(new SerialAdapter());
  register(new HIDAdapter());
  register(new WebUSBAdapter());
  register(new WebBluetoothAdapter());
}
