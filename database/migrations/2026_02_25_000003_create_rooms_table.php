<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('floorplan_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->decimal('x', 8, 4);
            $table->decimal('y', 8, 4);
            $table->decimal('width', 8, 4);
            $table->decimal('height', 8, 4);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rooms');
    }
};
