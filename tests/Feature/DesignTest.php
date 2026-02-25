<?php
namespace Tests\Feature;

use App\Models\Design;
use App\Models\Floorplan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DesignTest extends TestCase
{
    use RefreshDatabase;

    private function makeFloorplan(int $userId): Floorplan
    {
        return Floorplan::create([
            'user_id' => $userId, 'name' => 'FP', 'image_path' => 'fp.png',
            'width_px' => 800, 'height_px' => 600,
        ]);
    }

    public function test_create_form_requires_auth(): void
    {
        $this->get(route('designs.create'))->assertRedirect(route('login'));
    }

    public function test_create_form_accessible(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->withoutVite()->get(route('designs.create'))->assertOk();
    }

    public function test_user_can_create_design(): void
    {
        $user = User::factory()->create();
        $fp   = $this->makeFloorplan($user->id);

        $response = $this->actingAs($user)->post(route('designs.store'), [
            'name'          => 'My Design',
            'floorplan_ids' => [$fp->id],
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('designs', ['user_id' => $user->id, 'name' => 'My Design']);
        $this->assertDatabaseHas('design_floorplans', ['floorplan_id' => $fp->id]);
    }

    public function test_create_requires_name(): void
    {
        $user = User::factory()->create();
        $fp   = $this->makeFloorplan($user->id);

        $this->actingAs($user)->post(route('designs.store'), [
            'floorplan_ids' => [$fp->id],
        ])->assertSessionHasErrors('name');
    }

    public function test_create_requires_at_least_one_floorplan(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->post(route('designs.store'), [
            'name'          => 'My Design',
            'floorplan_ids' => [],
        ])->assertSessionHasErrors('floorplan_ids');
    }

    public function test_create_rejects_another_users_floorplan(): void
    {
        $user  = User::factory()->create();
        $other = User::factory()->create();
        $fp    = $this->makeFloorplan($other->id);

        $this->actingAs($user)->post(route('designs.store'), [
            'name'          => 'My Design',
            'floorplan_ids' => [$fp->id],
        ])->assertForbidden();
    }

    public function test_user_can_rename_design(): void
    {
        $user   = User::factory()->create();
        $design = Design::create(['user_id' => $user->id, 'name' => 'Old Name']);

        $this->actingAs($user)->patch(route('designs.update', $design), ['name' => 'New Name'])
             ->assertRedirect(route('dashboard'));

        $this->assertDatabaseHas('designs', ['id' => $design->id, 'name' => 'New Name']);
    }

    public function test_rename_forbidden_for_non_owner(): void
    {
        $owner  = User::factory()->create();
        $other  = User::factory()->create();
        $design = Design::create(['user_id' => $owner->id, 'name' => 'Name']);

        $this->actingAs($other)->patch(route('designs.update', $design), ['name' => 'Hacked'])
             ->assertForbidden();
    }

    public function test_user_can_delete_design(): void
    {
        $user   = User::factory()->create();
        $design = Design::create(['user_id' => $user->id, 'name' => 'To Delete']);

        $this->actingAs($user)->delete(route('designs.destroy', $design))
             ->assertRedirect(route('dashboard'));

        $this->assertDatabaseMissing('designs', ['id' => $design->id]);
    }

    public function test_delete_forbidden_for_non_owner(): void
    {
        $owner  = User::factory()->create();
        $other  = User::factory()->create();
        $design = Design::create(['user_id' => $owner->id, 'name' => 'Keep']);

        $this->actingAs($other)->delete(route('designs.destroy', $design))
             ->assertForbidden();
    }

    public function test_show_requires_auth(): void
    {
        $user   = User::factory()->create();
        $design = Design::create(['user_id' => $user->id, 'name' => 'Test']);

        $this->get(route('designs.show', $design))->assertRedirect(route('login'));
    }

    public function test_show_forbidden_for_non_owner(): void
    {
        $owner  = User::factory()->create();
        $other  = User::factory()->create();
        $design = Design::create(['user_id' => $owner->id, 'name' => 'Test']);

        $this->actingAs($other)->withoutVite()->get(route('designs.show', $design))
             ->assertForbidden();
    }

    public function test_update_requires_auth(): void
    {
        $user   = User::factory()->create();
        $design = Design::create(['user_id' => $user->id, 'name' => 'Test']);
        $this->patch(route('designs.update', $design), ['name' => 'New'])->assertRedirect(route('login'));
    }

    public function test_delete_requires_auth(): void
    {
        $user   = User::factory()->create();
        $design = Design::create(['user_id' => $user->id, 'name' => 'Test']);
        $this->delete(route('designs.destroy', $design))->assertRedirect(route('login'));
    }

    public function test_dashboard_shows_designs(): void
    {
        $user   = User::factory()->create();
        $design = Design::create(['user_id' => $user->id, 'name' => 'My Awesome Design']);

        $this->actingAs($user)->withoutVite()->get(route('dashboard'))
             ->assertOk()
             ->assertSee('My Awesome Design');
    }

    public function test_design_show_has_export_button(): void
    {
        $user   = User::factory()->create();
        $design = Design::create(['user_id' => $user->id, 'name' => 'Export Test Design']);
        $response = $this->actingAs($user)->withoutVite()->get(route('designs.show', $design));
        $response->assertOk();
        $response->assertSee('exportBtn', false);
        $response->assertSee('Export PNG');
    }
}
