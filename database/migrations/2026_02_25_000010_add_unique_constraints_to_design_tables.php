<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('design_floorplans', function (Blueprint $table) {
            $table->unique(['design_id', 'floorplan_id']);
        });

        Schema::table('design_room_highlights', function (Blueprint $table) {
            $table->unique(['design_id', 'room_id']);
        });
    }

    public function down(): void
    {
        Schema::table('design_floorplans', function (Blueprint $table) {
            $table->dropUnique(['design_id', 'floorplan_id']);
        });

        Schema::table('design_room_highlights', function (Blueprint $table) {
            $table->dropUnique(['design_id', 'room_id']);
        });
    }
};
