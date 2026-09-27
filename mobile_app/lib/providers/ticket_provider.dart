import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../core/constants/api_constants.dart';
import '../core/network/dio_client.dart';
import '../models/ticket_model.dart';

class TicketProvider extends ChangeNotifier {
  List<TicketModel> _tickets = [];
  bool _isLoading = false;
  String? _errorMessage;
  String _selectedFilter = 'All'; // 'All', 'Open', 'In_Progress', 'Resolved'

  List<TicketModel> get tickets {
    if (_selectedFilter == 'All') return _tickets;
    if (_selectedFilter == 'Open') return _tickets.where((t) => t.isOpen).toList();
    if (_selectedFilter == 'In_Progress') return _tickets.where((t) => t.isInProgress).toList();
    if (_selectedFilter == 'Resolved') return _tickets.where((t) => t.isResolved).toList();
    return _tickets;
  }

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  String get selectedFilter => _selectedFilter;

  void setFilter(String filter) {
    _selectedFilter = filter;
    notifyListeners();
  }

  // Fetch Tickets from API
  Future<void> fetchTickets() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await DioClient().dio.get(ApiConstants.endpointTickets);
      if (response.data != null) {
        final rawList = response.data is List 
            ? response.data 
            : (response.data['data'] is List ? response.data['data'] : []);
        
        _tickets = (rawList as List).map((item) => TicketModel.fromJson(item)).toList();
      }
    } on DioException catch (e) {
      _errorMessage = e.response?.data?['message'] ?? 'Gagal memuat daftar tiket.';
    } catch (e) {
      _errorMessage = 'Terjadi kesalahan: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Add Progress / Update Status with photo
  Future<bool> addProgress({
    required int ticketId,
    required String progressNotes,
    required String status,
    double? finalPowerDbm,
    String? photoBase64,
  }) async {
    try {
      final response = await DioClient().dio.post(
        ApiConstants.endpointTicketAddProgress(ticketId),
        data: {
          'progress_note': progressNotes,
          'status': status,
          'final_power_dbm': finalPowerDbm,
          if (photoBase64 != null) 'photo': photoBase64,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        await fetchTickets();
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }
}
