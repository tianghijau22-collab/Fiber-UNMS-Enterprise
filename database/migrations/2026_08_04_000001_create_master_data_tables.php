<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Wilayah - Provinces
        Schema::create('provinces', function (Blueprint $table) {
            $table->id();
            $table->string('code', 10)->unique();
            $table->string('name');
            $table->timestamps();
        });

        // 2. Wilayah - Regencies
        Schema::create('regencies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('province_id')->constrained('provinces')->cascadeOnDelete();
            $table->string('code', 10)->unique();
            $table->string('name');
            $table->string('type', 20)->default('Kabupaten'); // Kabupaten / Kota
            $table->timestamps();
        });

        // 3. Wilayah - Districts
        Schema::create('districts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('regency_id')->constrained('regencies')->cascadeOnDelete();
            $table->string('code', 10)->unique();
            $table->string('name');
            $table->timestamps();
        });

        // 4. Wilayah - Villages
        Schema::create('villages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('district_id')->constrained('districts')->cascadeOnDelete();
            $table->string('code', 15)->unique();
            $table->string('name');
            $table->string('postal_code', 10)->nullable();
            $table->timestamps();
        });

        // 5. Structure - Divisions
        Schema::create('divisions', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 20)->unique();
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // 6. Structure - Designations (Jabatan)
        Schema::create('designations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('division_id')->constrained('divisions')->cascadeOnDelete();
            $table->string('name');
            $table->string('code', 20)->unique();
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // 7. Vendors
        Schema::create('vendors', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 30)->unique();
            $table->string('contact_person')->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('email')->nullable();
            $table->text('address')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        // 8. Brands
        Schema::create('brands', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // 9. Device Types (OLT, POP, ODC, ODP, FAT, Joint Closure, ONT, Router, Switch)
        Schema::create('device_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 30)->unique();
            $table->string('category', 50); // OLT, POP, ODC, ODP, FAT, JOINT_CLOSURE, ONT, ROUTER, SWITCH, UPS
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // 10. Cable Types
        Schema::create('cable_types', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // misal: ADSS 24 Core, Armored Underground 48 Core
            $table->integer('core_capacity'); // 4, 8, 12, 24, 48, 96, 144
            $table->string('jacket_color', 30)->default('Black');
            $table->string('installation_type', 30)->default('Aerial'); // Aerial, Underground, Duct
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // 11. Splitter Types
        Schema::create('splitter_types', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // PLC 1:2, PLC 1:4, PLC 1:8, PLC 1:16, PLC 1:32, PLC 1:64
            $table->string('ratio', 10); // 1:2, 1:4, 1:8, 1:16, 1:32, 1:64
            $table->integer('input_ports')->default(1);
            $table->integer('output_ports');
            $table->decimal('loss_db', 5, 2)->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // 12. Item Categories (Inventory)
        Schema::create('item_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 30)->unique();
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // 13. Item Units
        Schema::create('item_units', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // Pcs, Meter, Roll, Box, Unit
            $table->string('symbol', 10);
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // 14. Service Packages (Internet FTTH)
        Schema::create('service_packages', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // Home Basic 20 Mbps, Business Pro 100 Mbps
            $table->string('code', 30)->unique();
            $table->integer('speed_mbps');
            $table->decimal('price', 12, 2);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        // 15. Roles & Permissions (RBAC)
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('group', 50)->default('general');
            $table->timestamps();
        });

        Schema::create('role_permission', function (Blueprint $table) {
            $table->foreignId('role_id')->constrained('roles')->cascadeOnDelete();
            $table->foreignId('permission_id')->constrained('permissions')->cascadeOnDelete();
            $table->primary(['role_id', 'permission_id']);
        });

        Schema::create('user_role', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('role_id')->constrained('roles')->cascadeOnDelete();
            $table->primary(['user_id', 'role_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_role');
        Schema::dropIfExists('role_permission');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('service_packages');
        Schema::dropIfExists('item_units');
        Schema::dropIfExists('item_categories');
        Schema::dropIfExists('splitter_types');
        Schema::dropIfExists('cable_types');
        Schema::dropIfExists('device_types');
        Schema::dropIfExists('brands');
        Schema::dropIfExists('vendors');
        Schema::dropIfExists('designations');
        Schema::dropIfExists('divisions');
        Schema::dropIfExists('villages');
        Schema::dropIfExists('districts');
        Schema::dropIfExists('regencies');
        Schema::dropIfExists('provinces');
    }
};
