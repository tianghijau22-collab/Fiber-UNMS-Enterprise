class ApiConstants {
  // Default base URL for production server
  static const String defaultBaseUrl = 'https://fiber-monitoring.103.89.6.125.sslip.io/api'; 
  
  // Storage Keys
  static const String keyServerUrl = 'server_base_url';
  static const String keyAuthToken = 'auth_token';
  static const String keyUserData = 'user_data';
  
  // Auth Endpoints
  static const String endpointLogin = '/auth/login';
  static const String endpointLogout = '/auth/logout';
  static const String endpointMe = '/auth/me';
  static const String endpointUpdateProfile = '/auth/profile';

  // Dashboard & Alerts
  static const String endpointDashboardMetrics = '/dashboard/metrics';
  static const String endpointSystemAlerts = '/system-alerts/feed';
  static const String endpointNotifications = '/notifications';

  // Tickets
  static const String endpointTickets = '/tickets';
  static const String endpointTicketReference = '/tickets/reference-data';
  static String endpointTicketAddProgress(int id) => '/tickets/$id/add-progress';
  static String endpointTicketTelegramDispatch(int id) => '/tickets/$id/dispatch-telegram';

  // Customers
  static const String endpointCustomers = '/customers';
  static String endpointCustomerSwapOnu(int id) => '/customers/$id/swap-onu';
  static String endpointCustomerDiagnostics(int id) => '/customers/$id/diagnostics';

  // ODP Measurements & OPM
  static const String endpointOdpChecks = '/odp-checks';
  static const String endpointOdpOptions = '/odp-checks/odp-options';
  static const String endpointOdpStats = '/odp-checks/stats';

  // OLT & ONT Diagnostics
  static const String endpointOlts = '/olts';
  static const String endpointOntAuthorize = '/olt/authorize-onu';
  static String endpointOntOpticalPower(String sn) => '/olt/optical-power/$sn';
  static const String endpointOrphanedOnus = '/olt/orphaned-onus';

  // GIS & Infrastructure Nodes
  static const String endpointGisMapData = '/gis/map-data';
  static const String endpointNetworkNodes = '/network-nodes';
  static String endpointNodePortDetail(int id) => '/network-nodes/$id/port-detail';
}
