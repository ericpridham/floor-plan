<?php
namespace App\Models;

use App\Models\Room;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DesignRoomHighlight extends Model
{
    use HasFactory;
    protected $fillable = ['design_id', 'room_id', 'key_entry_id'];

    public function design(): BelongsTo { return $this->belongsTo(Design::class); }
    public function room(): BelongsTo { return $this->belongsTo(Room::class); }
    public function keyEntry(): BelongsTo { return $this->belongsTo(DesignKeyEntry::class); }
}
