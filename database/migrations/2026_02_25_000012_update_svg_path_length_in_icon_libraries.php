<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('icon_libraries', function (Blueprint $table) {
            $table->string('svg_path', 500)->change();
        });
    }

    public function down(): void
    {
        Schema::table('icon_libraries', function (Blueprint $table) {
            $table->string('svg_path')->change();
        });
    }
};
