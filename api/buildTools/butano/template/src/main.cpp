
#include "bn_core.h"
#include "bn_fixed.h"
#include "bn_keypad.h"
#include "bn_random.h"
#include "bn_optional.h"

// Stubs for compiling the generated code
namespace scene_0_map {
    enum class collision_type { SOLID, NONE };
    collision_type get_collision(int x, int y) {
        return collision_type::NONE;
    }
}

namespace bn::sound_items {
    struct dummy_sound {
        void play() {}
    } snd_square_440_100;
}

namespace bn {
    struct dummy_sprite {
        void set_visible(bool v) {}
        void set_tiles(int t) {}
        void set_x(fixed x) {}
        void set_y(fixed y) {}
    };
    typedef dummy_sprite sprite_ptr;
    
    struct dummy_camera {
        void set_x(fixed x) {}
        void set_y(fixed y) {}
    };
    typedef dummy_camera camera_ptr;
}

int main()
{
    bn::core::init();
    bn::random rng;
    bn::camera_ptr camera;

    int proj_x[20];
    int proj_y[20];
    int proj_dx[20];
    int proj_dy[20];
    bool proj_active[20];
    bool proj_from_player[20];
    for(int i=0; i<20; ++i) {
        proj_active[i] = false;
        proj_from_player[i] = false;
    }
    bn::optional<bn::sprite_ptr> proj_sprites[20];
    int global_keys = 0;

    // Generated actor declarations
    bn::fixed actor_0_float_x = 8;
    bn::fixed actor_0_float_y = 16;
    int actor_0_x = actor_0_float_x.integer();
    int actor_0_y = actor_0_float_y.integer();
    bn::sprite_ptr actor_0_sprite = bn::dummy_sprite();
    int actor_0_timer = 0;
    bn::fixed actor_0_dx = 0;
    bn::fixed actor_0_dy = 0;
    bool actor_0_active = true;
    int actor_0_drop_through_timer = 0;
    bool actor_0_climbing = false;
    int actor_0_invincible_timer = 0;
    int actor_0_speed_timer = 0;
    int actor_0_idle_frames[] = { 0 };
    int actor_0_walk_frames[] = { 0 };
    int actor_0_anim_timer = 0;
    int actor_0_anim_idx = 0;
    int actor_0_anim_state = 0;
    int actor_0_anim_lock = 0;

    bn::fixed actor_1_float_x = 24;
    bn::fixed actor_1_float_y = 40;
    int actor_1_x = actor_1_float_x.integer();
    int actor_1_y = actor_1_float_y.integer();
    bn::sprite_ptr actor_1_sprite = bn::dummy_sprite();
    int actor_1_timer = 0;
    bn::fixed actor_1_dx = 0;
    bn::fixed actor_1_dy = 0;
    bool actor_1_active = true;
    bn::fixed actor_1_start_x = actor_1_float_x;
    bn::fixed actor_1_start_y = actor_1_float_y;
    int actor_1_dir = 1;
    bool actor_1_player_on = false;
    int actor_1_idle_frames[] = { 0 };
    int actor_1_walk_frames[] = { 0 };
    int actor_1_anim_timer = 0;
    int actor_1_anim_idx = 0;
    int actor_1_anim_state = 0;
    int actor_1_anim_lock = 0;

    bn::fixed actor_2_float_x = 80;
    bn::fixed actor_2_float_y = 56;
    int actor_2_x = actor_2_float_x.integer();
    int actor_2_y = actor_2_float_y.integer();
    bn::sprite_ptr actor_2_sprite = bn::dummy_sprite();
    int actor_2_timer = 0;
    bn::fixed actor_2_dx = 0;
    bn::fixed actor_2_dy = 0;
    bool actor_2_active = true;
    bool actor_2_player_on = false;
    int actor_2_idle_frames[] = { 0 };
    int actor_2_walk_frames[] = { 0 };
    int actor_2_anim_timer = 0;
    int actor_2_anim_idx = 0;
    int actor_2_anim_state = 0;
    int actor_2_anim_lock = 0;

    bn::fixed actor_3_float_x = 120;
    bn::fixed actor_3_float_y = 40;
    int actor_3_x = actor_3_float_x.integer();
    int actor_3_y = actor_3_float_y.integer();
    bn::sprite_ptr actor_3_sprite = bn::dummy_sprite();
    int actor_3_timer = 0;
    bn::fixed actor_3_dx = 0;
    bn::fixed actor_3_dy = 0;
    bool actor_3_active = true;
    bn::fixed actor_3_start_x = actor_3_float_x;
    bn::fixed actor_3_start_y = actor_3_float_y;
    int actor_3_dir = 1;
    int actor_3_idle_frames[] = { 0 };
    int actor_3_walk_frames[] = { 0 };
    int actor_3_anim_timer = 0;
    int actor_3_anim_idx = 0;
    int actor_3_anim_state = 0;
    int actor_3_anim_lock = 0;

    bn::fixed actor_4_float_x = 160;
    bn::fixed actor_4_float_y = 24;
    int actor_4_x = actor_4_float_x.integer();
    int actor_4_y = actor_4_float_y.integer();
    bn::sprite_ptr actor_4_sprite = bn::dummy_sprite();
    int actor_4_timer = 0;
    bn::fixed actor_4_dx = 0;
    bn::fixed actor_4_dy = 0;
    bool actor_4_active = true;
    int actor_4_idle_frames[] = { 0 };
    int actor_4_walk_frames[] = { 0 };
    int actor_4_anim_timer = 0;
    int actor_4_anim_idx = 0;
    int actor_4_anim_state = 0;
    int actor_4_anim_lock = 0;

    bn::fixed actor_5_float_x = 180;
    bn::fixed actor_5_float_y = 80;
    int actor_5_x = actor_5_float_x.integer();
    int actor_5_y = actor_5_float_y.integer();
    bn::sprite_ptr actor_5_sprite = bn::dummy_sprite();
    int actor_5_timer = 0;
    bn::fixed actor_5_dx = 0;
    bn::fixed actor_5_dy = 0;
    bool actor_5_active = true;
    bn::fixed actor_5_start_x = actor_5_float_x;
    bn::fixed actor_5_start_y = actor_5_float_y;
    int actor_5_dir = 1;
    int actor_5_idle_frames[] = { 0 };
    int actor_5_walk_frames[] = { 0 };
    int actor_5_anim_timer = 0;
    int actor_5_anim_idx = 0;
    int actor_5_anim_state = 0;
    int actor_5_anim_lock = 0;

    bn::fixed actor_6_float_x = 200;
    bn::fixed actor_6_float_y = 96;
    int actor_6_x = actor_6_float_x.integer();
    int actor_6_y = actor_6_float_y.integer();
    bn::sprite_ptr actor_6_sprite = bn::dummy_sprite();
    int actor_6_timer = 0;
    bn::fixed actor_6_dx = 0;
    bn::fixed actor_6_dy = 0;
    bool actor_6_active = true;
    bn::fixed actor_6_start_x = actor_6_float_x;
    bn::fixed actor_6_start_y = actor_6_float_y;
    int actor_6_dir = 1;
    int actor_6_idle_frames[] = { 0 };
    int actor_6_walk_frames[] = { 0 };
    int actor_6_anim_timer = 0;
    int actor_6_anim_idx = 0;
    int actor_6_anim_state = 0;
    int actor_6_anim_lock = 0;

    bn::fixed actor_7_float_x = 50;
    bn::fixed actor_7_float_y = 96;
    int actor_7_x = actor_7_float_x.integer();
    int actor_7_y = actor_7_float_y.integer();
    bn::sprite_ptr actor_7_sprite = bn::dummy_sprite();
    int actor_7_timer = 0;
    bn::fixed actor_7_dx = 0;
    bn::fixed actor_7_dy = 0;
    bool actor_7_active = true;
    int actor_7_hp = 3;
    int actor_7_shoot_timer = 0;
    bn::fixed actor_7_start_x = actor_7_float_x;
    bn::fixed actor_7_start_y = actor_7_float_y;
    int actor_7_dir = 1;
    int actor_7_idle_frames[] = { 0 };
    int actor_7_walk_frames[] = { 0 };
    int actor_7_anim_timer = 0;
    int actor_7_anim_idx = 0;
    int actor_7_anim_state = 0;
    int actor_7_anim_lock = 0;

    bn::fixed actor_8_float_x = 110;
    bn::fixed actor_8_float_y = 96;
    int actor_8_x = actor_8_float_x.integer();
    int actor_8_y = actor_8_float_y.integer();
    bn::sprite_ptr actor_8_sprite = bn::dummy_sprite();
    int actor_8_timer = 0;
    bn::fixed actor_8_dx = 0;
    bn::fixed actor_8_dy = 0;
    bool actor_8_active = true;
    int actor_8_hp = 3;
    bn::fixed actor_8_start_x = actor_8_float_x;
    bn::fixed actor_8_start_y = actor_8_float_y;
    int actor_8_dir = 1;
    int actor_8_idle_frames[] = { 0 };
    int actor_8_walk_frames[] = { 0 };
    int actor_8_anim_timer = 0;
    int actor_8_anim_idx = 0;
    int actor_8_anim_state = 0;
    int actor_8_anim_lock = 0;

    bn::fixed actor_9_float_x = 100;
    bn::fixed actor_9_float_y = 96;
    int actor_9_x = actor_9_float_x.integer();
    int actor_9_y = actor_9_float_y.integer();
    bn::sprite_ptr actor_9_sprite = bn::dummy_sprite();
    int actor_9_timer = 0;
    bn::fixed actor_9_dx = 0;
    bn::fixed actor_9_dy = 0;
    bool actor_9_active = true;
    int actor_9_idle_frames[] = { 0 };
    int actor_9_walk_frames[] = { 0 };
    int actor_9_anim_timer = 0;
    int actor_9_anim_idx = 0;
    int actor_9_anim_state = 0;
    int actor_9_anim_lock = 0;

    bn::fixed actor_10_float_x = 140;
    bn::fixed actor_10_float_y = 56;
    int actor_10_x = actor_10_float_x.integer();
    int actor_10_y = actor_10_float_y.integer();
    bn::sprite_ptr actor_10_sprite = bn::dummy_sprite();
    int actor_10_timer = 0;
    bn::fixed actor_10_dx = 0;
    bn::fixed actor_10_dy = 0;
    bool actor_10_active = true;
    int actor_10_hp = 2;
    bool actor_10_player_on = false;
    int actor_10_idle_frames[] = { 0 };
    int actor_10_walk_frames[] = { 0 };
    int actor_10_anim_timer = 0;
    int actor_10_anim_idx = 0;
    int actor_10_anim_state = 0;
    int actor_10_anim_lock = 0;

    bn::fixed actor_11_float_x = 160;
    bn::fixed actor_11_float_y = 56;
    int actor_11_x = actor_11_float_x.integer();
    int actor_11_y = actor_11_float_y.integer();
    bn::sprite_ptr actor_11_sprite = bn::dummy_sprite();
    int actor_11_timer = 0;
    bn::fixed actor_11_dx = 0;
    bn::fixed actor_11_dy = 0;
    bool actor_11_active = true;
    int actor_11_idle_frames[] = { 0 };
    int actor_11_walk_frames[] = { 0 };
    int actor_11_anim_timer = 0;
    int actor_11_anim_idx = 0;
    int actor_11_anim_state = 0;
    int actor_11_anim_lock = 0;

    bn::fixed actor_12_float_x = 180;
    bn::fixed actor_12_float_y = 56;
    int actor_12_x = actor_12_float_x.integer();
    int actor_12_y = actor_12_float_y.integer();
    bn::sprite_ptr actor_12_sprite = bn::dummy_sprite();
    int actor_12_timer = 0;
    bn::fixed actor_12_dx = 0;
    bn::fixed actor_12_dy = 0;
    bool actor_12_active = true;
    bool actor_12_player_on = false;
    int actor_12_idle_frames[] = { 0 };
    int actor_12_walk_frames[] = { 0 };
    int actor_12_anim_timer = 0;
    int actor_12_anim_idx = 0;
    int actor_12_anim_state = 0;
    int actor_12_anim_lock = 0;

    bn::fixed actor_13_float_x = 200;
    bn::fixed actor_13_float_y = 56;
    int actor_13_x = actor_13_float_x.integer();
    int actor_13_y = actor_13_float_y.integer();
    bn::sprite_ptr actor_13_sprite = bn::dummy_sprite();
    int actor_13_timer = 0;
    bn::fixed actor_13_dx = 0;
    bn::fixed actor_13_dy = 0;
    bool actor_13_active = true;
    int actor_13_idle_frames[] = { 0 };
    int actor_13_walk_frames[] = { 0 };
    int actor_13_anim_timer = 0;
    int actor_13_anim_idx = 0;
    int actor_13_anim_state = 0;
    int actor_13_anim_lock = 0;

    bn::fixed actor_14_float_x = 220;
    bn::fixed actor_14_float_y = 56;
    int actor_14_x = actor_14_float_x.integer();
    int actor_14_y = actor_14_float_y.integer();
    bn::sprite_ptr actor_14_sprite = bn::dummy_sprite();
    int actor_14_timer = 0;
    bn::fixed actor_14_dx = 0;
    bn::fixed actor_14_dy = 0;
    bool actor_14_active = true;
    bool actor_14_hit_active = false;
    int actor_14_idle_frames[] = { 0 };
    int actor_14_walk_frames[] = { 0 };
    int actor_14_anim_timer = 0;
    int actor_14_anim_idx = 0;
    int actor_14_anim_state = 0;
    int actor_14_anim_lock = 0;



    while(true)
    {
        // Generated actor update logic
        if (actor_0_active) {
            if (actor_0_invincible_timer > 0) {
                actor_0_invincible_timer--;
                actor_0_sprite.set_visible((actor_0_invincible_timer % 4) < 2);
            } else {
                actor_0_sprite.set_visible(true);
            }
            if (actor_0_speed_timer > 0) {
                actor_0_speed_timer--;
            }
            actor_0_dx = 0;
            bool on_ladder = false;
            if (actor_3_active) {
                int px_l = actor_0_float_x.integer() + 0;
                int px_r = px_l + 16;
                int py_t = actor_0_float_y.integer() + 0;
                int py_b = py_t + 16;
                int lx_l = actor_3_x + 0;
                int lx_r = lx_l + 16;
                int ly_t = actor_3_y + 0;
                int ly_b = ly_t + 48;
                if (px_r > lx_l && px_l < lx_r && py_b > ly_t && py_t < ly_b) {
                    on_ladder = true;
                }
            }
            if (on_ladder && (bn::keypad::up_held() || bn::keypad::down_held())) {
                actor_0_climbing = true;
            }
            if (!on_ladder) {
                actor_0_climbing = false;
            }
            if (actor_0_climbing) {
                actor_0_dx = 0;
                actor_0_dy = 0;
                if (bn::keypad::up_held()) actor_0_dy = -1;
                else if (bn::keypad::down_held()) actor_0_dy = 1;
                if (bn::keypad::left_held()) actor_0_dx = -1;
                else if (bn::keypad::right_held()) actor_0_dx = 1;
                if (bn::keypad::a_pressed()) {
                    actor_0_climbing = false;
                    actor_0_dy = bn::fixed(-5.5);
                }
            } else {
            if (bn::keypad::left_held()) actor_0_dx = -1;
            else if (bn::keypad::right_held()) actor_0_dx = 1;
            actor_0_dy += bn::fixed(0.4);
            if (actor_0_dy > bn::fixed(6)) actor_0_dy = bn::fixed(6);
            if (actor_0_drop_through_timer > 0) actor_0_drop_through_timer--;
            if (actor_0_speed_timer > 0) {
                actor_0_dx = actor_0_dx * 2;
                if (actor_0_climbing) actor_0_dy = actor_0_dy * 2;
            }
            bool on_ground = false;
            int check_y = (actor_0_float_y.integer() + 0 + 16) / 8;
            int check_x = (actor_0_float_x.integer() + 0 + 8) / 8;
            if (scene_0_map::get_collision(check_x, check_y) == scene_0_map::collision_type::SOLID) {
                on_ground = true;
                if (actor_0_dy > 0) actor_0_dy = 0;
            }
            if (actor_1_active && actor_0_dy >= 0) {
                int px = actor_0_float_x.integer() + 0 + 8;
                int py = actor_0_float_y.integer() + 0 + 16;
                int plat_l = actor_1_x + 0;
                int plat_r = actor_1_x + 0 + 32;
                int plat_t = actor_1_y + 0;
                int plat_b = actor_1_y + 0 + 8;
                if (px >= plat_l && px <= plat_r && py >= plat_t && py <= plat_t + 8) {
                    on_ground = true;
                    actor_0_float_y = plat_t - (0 + 16);
                    if (actor_0_dy > 0) actor_0_dy = 0;
                    actor_0_float_x += actor_1_dx;
                    actor_0_float_y += actor_1_dy;
                    actor_1_player_on = true;
                }
            }
            if (actor_2_active && actor_0_dy >= 0 && actor_0_drop_through_timer == 0) {
                if (bn::keypad::down_held() && bn::keypad::a_pressed()) {
                    actor_0_drop_through_timer = 15;
                    actor_0_float_y += 4;
                } else {
                int px = actor_0_float_x.integer() + 0 + 8;
                int py = actor_0_float_y.integer() + 0 + 16;
                int plat_l = actor_2_x + 0;
                int plat_r = actor_2_x + 0 + 32;
                int plat_t = actor_2_y + 0;
                int plat_b = actor_2_y + 0 + 8;
                if (px >= plat_l && px <= plat_r && py >= plat_t && py <= plat_t + 8) {
                    on_ground = true;
                    actor_0_float_y = plat_t - (0 + 16);
                    if (actor_0_dy > 0) actor_0_dy = 0;
                }
                }
            }
            if (actor_10_active && actor_0_dy >= 0) {
                int px = actor_0_float_x.integer() + 0 + 8;
                int py = actor_0_float_y.integer() + 0 + 16;
                int plat_l = actor_10_x + 0;
                int plat_r = actor_10_x + 0 + 16;
                int plat_t = actor_10_y + 0;
                int plat_b = actor_10_y + 0 + 16;
                if (px >= plat_l && px <= plat_r && py >= plat_t && py <= plat_t + 8) {
                    actor_10_hp--;
                    actor_0_dy = -3;
                    bn::sound_items::snd_square_440_100.play();
                    if (actor_10_hp <= 0) {
                        actor_10_active = false;
                        actor_10_sprite.set_visible(false);
                        actor_4_float_x = actor_10_x;
                        actor_4_float_y = actor_10_y;
                        actor_4_x = actor_10_x;
                        actor_4_y = actor_10_y;
                        actor_4_active = true;
                    } else {
                        on_ground = true;
                        actor_0_float_y = plat_t - (0 + 16);
                    }
                }
            }
            if (actor_12_active && actor_0_dy >= 0) {
                int px = actor_0_float_x.integer() + 0 + 8;
                int py = actor_0_float_y.integer() + 0 + 16;
                int plat_l = actor_12_x + 0;
                int plat_r = actor_12_x + 0 + 16;
                int plat_t = actor_12_y + 0;
                int plat_b = actor_12_y + 0 + 16;
                if (px >= plat_l && px <= plat_r && py >= plat_t && py <= plat_t + 8) {
                    on_ground = true;
                    actor_0_float_y = plat_t - (0 + 16);
                    if (actor_0_dy > 0) actor_0_dy = 0;
                }
            }
            if (on_ground && bn::keypad::a_pressed()) actor_0_dy = bn::fixed(-5.5);
            }
            if (actor_4_active) {
                int px_l = actor_0_float_x.integer() + 0;
                int px_r = px_l + 16;
                int py_t = actor_0_float_y.integer() + 0;
                int py_b = py_t + 16;
                int cx_l = actor_4_x + 0;
                int cx_r = cx_l + 8;
                int cy_t = actor_4_y + 0;
                int cy_b = cy_t + 8;
                if (px_r > cx_l && px_l < cx_r && py_b > cy_t && py_t < cy_b) {
                    actor_4_active = false;
                    actor_4_sprite.set_visible(false);
                    bn::sound_items::snd_square_440_100.play();
                }
            }
            if (actor_11_active) {
                int px_l = actor_0_float_x.integer() + 0;
                int px_r = px_l + 16;
                int py_t = actor_0_float_y.integer() + 0;
                int py_b = py_t + 16;
                int kx_l = actor_11_x + 0;
                int kx_r = kx_l + 16;
                int ky_t = actor_11_y + 0;
                int ky_b = ky_t + 16;
                if (px_r > kx_l && px_l < kx_r && py_b > ky_t && py_t < ky_b) {
                    actor_11_active = false;
                    actor_11_sprite.set_visible(false);
                    global_keys++;
                    bn::sound_items::snd_square_440_100.play();
                }
            }
            if (actor_12_active) {
                int px_l = actor_0_float_x.integer() + 0;
                int px_r = px_l + 16;
                int py_t = actor_0_float_y.integer() + 0;
                int py_b = py_t + 16;
                int dx_l = actor_12_x + 0;
                int dx_r = dx_l + 16;
                int dy_t = actor_12_y + 0;
                int dy_b = actor_12_y + 0 + 16;
                if (px_r + 1 > dx_l && px_l - 1 < dx_r && py_b + 1 > dy_t && py_t - 1 < dy_b) {
                    if (global_keys > 0) {
                        global_keys--;
                        actor_12_active = false;
                        actor_12_sprite.set_visible(false);
                        bn::sound_items::snd_square_440_100.play();
                    }
                }
            }
            if (actor_13_active) {
                int px_l = actor_0_float_x.integer() + 0;
                int px_r = px_l + 16;
                int py_t = actor_0_float_y.integer() + 0;
                int py_b = py_t + 16;
                int pux_l = actor_13_x + 0;
                int pux_r = pux_l + 16;
                int puy_t = actor_13_y + 0;
                int puy_b = puy_t + 16;
                if (px_r > pux_l && px_l < pux_r && py_b > puy_t && py_t < puy_b) {
                    actor_13_active = false;
                    actor_13_sprite.set_visible(false);
                    bn::sound_items::snd_square_440_100.play();
                    actor_0_invincible_timer = 300;
                }
            }
            if (actor_5_active) {
                int px_l = actor_0_float_x.integer() + 0;
                int px_r = px_l + 16;
                int py_b = actor_0_float_y.integer() + 0 + 16;
                int sx_l = actor_5_x + 0;
                int sx_r = sx_l + 16;
                int sy_t = actor_5_y + 0;
                if (actor_0_dy >= 0 && px_r > sx_l && px_l < sx_r && py_b >= sy_t && py_b <= sy_t + 8) {
                    actor_0_dy = bn::fixed(-7.5);
                    actor_0_float_y = sy_t - (0 + 16);
                    bn::sound_items::snd_square_440_100.play();
                }
            }
            if (actor_6_active) {
                int px_l = actor_0_float_x.integer() + 0;
                int px_r = px_l + 16;
                int py_t = actor_0_float_y.integer() + 0;
                int py_b = py_t + 16;
                int hx_l = actor_6_x + 0;
                int hx_r = hx_l + 16;
                int hy_t = actor_6_y + 0;
                int hy_b = hy_t + 8;
                if (px_r > hx_l && px_l < hx_r && py_b > hy_t && py_t < hy_b) {
                    if (actor_0_invincible_timer == 0) {
                        actor_0_float_x = 8;
                        actor_0_float_y = 16;
                        actor_0_dy = 0;
                        bn::sound_items::snd_square_440_100.play();
                    }
                }
            }
            if (actor_10_active && actor_0_dy < 0) {
                int px_l = actor_0_float_x.integer() + 0;
                int px_r = px_l + 16;
                int py_t = actor_0_float_y.integer() + 0;
                int bx_l = actor_10_x + 0;
                int bx_r = bx_l + 16;
                int by_b = actor_10_y + 0 + 16;
                if (px_r > bx_l && px_l < bx_r && py_t + actor_0_dy <= by_b && py_t >= by_b - 6) {
                    actor_0_dy = bn::fixed(0.5);
                    actor_10_hp--;
                    bn::sound_items::snd_square_440_100.play();
                    if (actor_10_hp <= 0) {
                        actor_10_active = false;
                        actor_10_sprite.set_visible(false);
                        actor_4_float_x = actor_10_x;
                        actor_4_float_y = actor_10_y;
                        actor_4_x = actor_10_x;
                        actor_4_y = actor_10_y;
                        actor_4_active = true;
                    }
                }
            }
            if (actor_7_active) {
                int px_l = actor_0_float_x.integer() + 0;
                int px_r = px_l + 16;
                int py_t = actor_0_float_y.integer() + 0;
                int py_b = py_t + 16;
                int ex_l = actor_7_x + 0;
                int ex_r = ex_l + 16;
                int ey_t = actor_7_y + 0;
                int ey_b = ey_t + 16;
                if (px_r > ex_l && px_l < ex_r && py_b > ey_t && py_t < ey_b) {
                    if (actor_0_invincible_timer > 0) {
                        actor_7_hp = 0;
                        actor_7_active = false;
                        actor_7_sprite.set_visible(false);
                        bn::sound_items::snd_square_440_100.play();
                    } else if (actor_0_dy > 0 && py_b <= ey_t + 8) {
                        actor_7_hp--;
                        actor_0_dy = -3;
                        bn::sound_items::snd_square_440_100.play();
                        if (actor_7_hp <= 0) {
                            actor_7_active = false;
                            actor_7_sprite.set_visible(false);
                        }
                    } else {
                        actor_0_float_x = 8;
                        actor_0_float_y = 16;
                        actor_0_dy = 0;
                        bn::sound_items::snd_square_440_100.play();
                    }
                }
            }
            if (actor_8_active) {
                int px_l = actor_0_float_x.integer() + 0;
                int px_r = px_l + 16;
                int py_t = actor_0_float_y.integer() + 0;
                int py_b = py_t + 16;
                int ex_l = actor_8_x + 0;
                int ex_r = ex_l + 16;
                int ey_t = actor_8_y + 0;
                int ey_b = ey_t + 16;
                if (px_r > ex_l && px_l < ex_r && py_b > ey_t && py_t < ey_b) {
                    if (actor_0_invincible_timer > 0) {
                        actor_8_hp = 0;
                        actor_8_active = false;
                        actor_8_sprite.set_visible(false);
                        bn::sound_items::snd_square_440_100.play();
                    } else if (actor_0_dy > 0 && py_b <= ey_t + 8) {
                        actor_8_hp--;
                        actor_0_dy = -3;
                        bn::sound_items::snd_square_440_100.play();
                        if (actor_8_hp <= 0) {
                            actor_8_active = false;
                            actor_8_sprite.set_visible(false);
                        }
                    } else {
                        actor_0_float_x = 8;
                        actor_0_float_y = 16;
                        actor_0_dy = 0;
                        bn::sound_items::snd_square_440_100.play();
                    }
                }
            }
            for(int p=0; p<20; ++p) {
                if(proj_active[p] && !proj_from_player[p]) {
                    int proj_w = 8; int proj_h = 8;
                    int px_l = actor_0_float_x.integer() + 0;
                    int px_r = px_l + 16;
                    int py_t = actor_0_float_y.integer() + 0;
                    int py_b = py_t + 16;
                    if (proj_x[p] + proj_w > px_l && proj_x[p] < px_r &&
                        proj_y[p] + proj_h > py_t && proj_y[p] < py_b) {
                        proj_active[p] = false;
                        proj_sprites[p].reset();
                        if (actor_0_invincible_timer == 0) {
                            actor_0_float_x = 8;
                            actor_0_float_y = 16;
                            actor_0_dy = 0;
                            bn::sound_items::snd_square_440_100.play();
                        }
                    }
                }
            }
            if (actor_14_active) {
                int px_l = actor_0_float_x.integer() + 0;
                int px_r = px_l + 16;
                int py_t = actor_0_float_y.integer() + 0;
                int py_b = py_t + 16;
                int ox_l = actor_14_x + 0;
                int ox_r = ox_l + 16;
                int oy_t = actor_14_y + 0;
                int oy_b = oy_t + 16;
                bool inside_14 = px_r > ox_l && px_l < ox_r && py_b > oy_t && py_t < oy_b;
                if (inside_14 && !actor_14_hit_active) {
                    actor_14_hit_active = true;
// mock script logic
                } else if (!inside_14) {
                    actor_14_hit_active = false;
                }
                if (inside_14 && bn::keypad::a_pressed()) {
// mock script logic
                }
            }
            if (actor_0_dx != 0 || actor_0_dy != 0) {
                bn::fixed new_x = actor_0_float_x + actor_0_dx;
                bn::fixed new_y = actor_0_float_y + actor_0_dy;
                int tile_x = (new_x.integer() + 0 + 8) / 8;
                int tile_y = (new_y.integer() + 0 + 8) / 8;
                if (scene_0_map::get_collision(tile_x, tile_y) != scene_0_map::collision_type::SOLID) {
                    bool hit_platform = false;
                    if (actor_1_active) {
                        int px_l = new_x.integer() + 0;
                        int px_r = new_x.integer() + 0 + 16;
                        int py_t = new_y.integer() + 0;
                        int py_b = new_y.integer() + 0 + 16;
                        int plat_l = actor_1_x + 0;
                        int plat_r = actor_1_x + 0 + 32;
                        int plat_t = actor_1_y + 0;
                        int plat_b = actor_1_y + 0 + 8;
                        if (px_r > plat_l && px_l < plat_r && py_b > plat_t && py_t < plat_b) {
                            hit_platform = true;
                        }
                    }
                    if (actor_2_active) {
                        int px_l = new_x.integer() + 0;
                        int px_r = new_x.integer() + 0 + 16;
                        int py_t = new_y.integer() + 0;
                        int py_b = new_y.integer() + 0 + 16;
                        int plat_l = actor_2_x + 0;
                        int plat_r = actor_2_x + 0 + 32;
                        int plat_t = actor_2_y + 0;
                        int plat_b = actor_2_y + 0 + 8;
                        if (actor_0_dy < 0 && px_r > plat_l && px_l < plat_r && py_t < plat_b && py_b > plat_b) {
                            hit_platform = true;
                        }
                    }
                    if (actor_10_active) {
                        int px_l = new_x.integer() + 0;
                        int px_r = new_x.integer() + 0 + 16;
                        int py_t = new_y.integer() + 0;
                        int py_b = new_y.integer() + 0 + 16;
                        int plat_l = actor_10_x + 0;
                        int plat_r = actor_10_x + 0 + 16;
                        int plat_t = actor_10_y + 0;
                        int plat_b = actor_10_y + 0 + 16;
                        if (px_r > plat_l && px_l < plat_r && py_b > plat_t && py_t < plat_b) {
                            hit_platform = true;
                        }
                    }
                    if (actor_12_active) {
                        int px_l = new_x.integer() + 0;
                        int px_r = new_x.integer() + 0 + 16;
                        int py_t = new_y.integer() + 0;
                        int py_b = new_y.integer() + 0 + 16;
                        int plat_l = actor_12_x + 0;
                        int plat_r = actor_12_x + 0 + 16;
                        int plat_t = actor_12_y + 0;
                        int plat_b = actor_12_y + 0 + 16;
                        if (px_r > plat_l && px_l < plat_r && py_b > plat_t && py_t < plat_b) {
                            hit_platform = true;
                        }
                    }
                    if (!hit_platform) {
                        actor_0_float_x = new_x;
                        actor_0_float_y = new_y;
                    }
                }
            }
            actor_0_x = actor_0_float_x.integer();
            actor_0_y = actor_0_float_y.integer();
        }
        if (actor_1_active) {
            bn::fixed speed_1 = bn::fixed(1);
            if (actor_1_player_on) {
                actor_1_float_y += speed_1 * actor_1_dir;
                if (actor_1_dir == 1 && actor_1_float_y >= actor_1_start_y + bn::fixed(48)) {
                    actor_1_float_y = actor_1_start_y + bn::fixed(48);
                    actor_1_dir = -1;
                } else if (actor_1_dir == -1 && actor_1_float_y <= actor_1_start_y) {
                    actor_1_float_y = actor_1_start_y;
                    actor_1_dir = 1;
                }
                actor_1_dy = speed_1 * actor_1_dir;
                actor_1_dx = 0;
            } else {
                actor_1_dx = 0;
                actor_1_dy = 0;
            }
            actor_1_player_on = false;
            actor_1_x = actor_1_float_x.integer();
            actor_1_y = actor_1_float_y.integer();
        }
        if (actor_2_active) {
            actor_2_dx = 0;
            actor_2_dy = 0;
        }
        if (actor_3_active) {
            bn::fixed speed_3 = bn::fixed(0.5);
                actor_3_float_x += speed_3 * actor_3_dir;
                if (actor_3_dir == 1 && actor_3_float_x >= actor_3_start_x + bn::fixed(32)) {
                    actor_3_float_x = actor_3_start_x + bn::fixed(32);
                    actor_3_dir = -1;
                } else if (actor_3_dir == -1 && actor_3_float_x <= actor_3_start_x) {
                    actor_3_float_x = actor_3_start_x;
                    actor_3_dir = 1;
                }
                actor_3_dx = speed_3 * actor_3_dir;
                actor_3_dy = 0;
            actor_3_x = actor_3_float_x.integer();
            actor_3_y = actor_3_float_y.integer();
        }
        if (actor_4_active) {
            actor_4_dx = 0;
            actor_4_dy = 0;
        }
        if (actor_5_active) {
            bn::fixed speed_5 = bn::fixed(1.5);
                actor_5_float_y += speed_5 * actor_5_dir;
                if (actor_5_dir == 1 && actor_5_float_y >= actor_5_start_y + bn::fixed(16)) {
                    actor_5_float_y = actor_5_start_y + bn::fixed(16);
                    actor_5_dir = -1;
                } else if (actor_5_dir == -1 && actor_5_float_y <= actor_5_start_y) {
                    actor_5_float_y = actor_5_start_y;
                    actor_5_dir = 1;
                }
                actor_5_dy = speed_5 * actor_5_dir;
                actor_5_dx = 0;
            actor_5_x = actor_5_float_x.integer();
            actor_5_y = actor_5_float_y.integer();
        }
        if (actor_6_active) {
            bn::fixed speed_6 = bn::fixed(2);
                actor_6_float_x += speed_6 * actor_6_dir;
                if (actor_6_dir == 1 && actor_6_float_x >= actor_6_start_x + bn::fixed(64)) {
                    actor_6_float_x = actor_6_start_x + bn::fixed(64);
                    actor_6_dir = -1;
                } else if (actor_6_dir == -1 && actor_6_float_x <= actor_6_start_x) {
                    actor_6_float_x = actor_6_start_x;
                    actor_6_dir = 1;
                }
                actor_6_dx = speed_6 * actor_6_dir;
                actor_6_dy = 0;
            actor_6_x = actor_6_float_x.integer();
            actor_6_y = actor_6_float_y.integer();
        }
        if (actor_7_active) {
            actor_7_dx = 0;
            actor_7_dy = 0;
            if (actor_0_active) {
                bn::fixed target_dx = 0;
                bn::fixed target_dy = 0;
                bn::fixed speed_7 = bn::fixed(1);
                if (actor_0_float_x > actor_7_float_x + 1) target_dx = speed_7;
                else if (actor_0_float_x < actor_7_float_x - 1) target_dx = -speed_7;
                actor_7_dx = target_dx;
                actor_7_dy = target_dy;
            }
            if (actor_7_dx != 0 || actor_7_dy != 0) {
                bn::fixed new_x = actor_7_float_x + actor_7_dx;
                bn::fixed new_y = actor_7_float_y + actor_7_dy;
                int tile_x = (new_x.integer() + 0 + 8) / 8;
                int tile_y = (new_y.integer() + 0 + 8) / 8;
                if (scene_0_map::get_collision(tile_x, tile_y) != scene_0_map::collision_type::SOLID) {
                    actor_7_float_x = new_x;
                    actor_7_float_y = new_y;
                }
            }
            actor_7_x = actor_7_float_x.integer();
            actor_7_y = actor_7_float_y.integer();
            if (actor_7_shoot_timer > 0) {
                actor_7_shoot_timer--;
            } else {
                actor_7_shoot_timer = 60;
                if (actor_0_active) {
                    int diff_x = actor_0_x - actor_7_x;
                    int diff_y = actor_0_y - actor_7_y;
                    int p_dx = 0;
                    int p_dy = 0;
                    if (diff_x > 8) p_dx = 2;
                    else if (diff_x < -8) p_dx = -2;
                    if (diff_y > 8) p_dy = 2;
                    else if (diff_y < -8) p_dy = -2;
                    if (p_dx == 0 && p_dy == 0) {
                        p_dx = -2;
                    }
                    for(int p=0; p<20; ++p) {
                        if(!proj_active[p]) {
                            proj_x[p] = actor_7_x + 8;
                            proj_y[p] = actor_7_y + 8;
                            proj_dx[p] = p_dx;
                            proj_dy[p] = p_dy;
                            proj_active[p] = true;
                            proj_from_player[p] = false;
                            break;
                        }
                    }
                }
            }
            for(int p=0; p<20; ++p) {
                if(proj_active[p] && proj_from_player[p]) {
                    int proj_w = 8; int proj_h = 8;
                    if (proj_x[p] + proj_w > actor_7_x + 0 && proj_x[p] < actor_7_x + 0 + 16 &&
                        proj_y[p] + proj_h > actor_7_y + 0 && proj_y[p] < actor_7_y + 0 + 16) {
                        proj_active[p] = false;
                        actor_7_hp--;
                        bn::sound_items::snd_square_440_100.play();
                        if (actor_7_hp <= 0) {
                            actor_7_active = false;
                            actor_7_sprite.set_visible(false);
                        }
                    }
                }
            }
        }
        if (actor_8_active) {
            bn::fixed speed_8 = bn::fixed(1);
            actor_8_float_x += speed_8 * actor_8_dir;
            if (actor_8_dir == 1 && actor_8_float_x >= actor_8_start_x + bn::fixed(48)) {
                actor_8_float_x = actor_8_start_x + bn::fixed(48);
                actor_8_dir = -1;
            } else if (actor_8_dir == -1 && actor_8_float_x <= actor_8_start_x) {
                actor_8_float_x = actor_8_start_x;
                actor_8_dir = 1;
            }
            actor_8_dx = speed_8 * actor_8_dir;
            actor_8_dy = 0;
            actor_8_x = actor_8_float_x.integer();
            actor_8_y = actor_8_float_y.integer();
            for(int p=0; p<20; ++p) {
                if(proj_active[p] && proj_from_player[p]) {
                    int proj_w = 8; int proj_h = 8;
                    if (proj_x[p] + proj_w > actor_8_x + 0 && proj_x[p] < actor_8_x + 0 + 16 &&
                        proj_y[p] + proj_h > actor_8_y + 0 && proj_y[p] < actor_8_y + 0 + 16) {
                        proj_active[p] = false;
                        actor_8_hp--;
                        bn::sound_items::snd_square_440_100.play();
                        if (actor_8_hp <= 0) {
                            actor_8_active = false;
                            actor_8_sprite.set_visible(false);
                        }
                    }
                }
            }
        }
        if (actor_9_active) {
            if (actor_9_timer > 0) { actor_9_timer--; }
            else {
                actor_9_timer = (rng.get_int(60) + 30);
                int r = rng.get_int(5);
                if (r == 0) { actor_9_dx = 1; actor_9_dy = 0; }
                else if (r == 1) { actor_9_dx = -1; actor_9_dy = 0; }
                else if (r == 2) { actor_9_dx = 0; actor_9_dy = 1; }
                else if (r == 3) { actor_9_dx = 0; actor_9_dy = -1; }
                else { actor_9_dx = 0; actor_9_dy = 0; }
            }
            if (actor_9_dx != 0 || actor_9_dy != 0) {
                bn::fixed new_x = actor_9_float_x + actor_9_dx;
                bn::fixed new_y = actor_9_float_y + actor_9_dy;
                int tile_x = (new_x.integer() + 0 + 8) / 8;
                int tile_y = (new_y.integer() + 0 + 8) / 8;
                if (scene_0_map::get_collision(tile_x, tile_y) != scene_0_map::collision_type::SOLID) {
                    actor_9_float_x = new_x;
                    actor_9_float_y = new_y;
                } else { actor_9_timer = 0; }
            }
            actor_9_x = actor_9_float_x.integer();
            actor_9_y = actor_9_float_y.integer();
        }
        if (actor_10_active) {
            actor_10_dx = 0;
            actor_10_dy = 0;
            for(int p=0; p<20; ++p) {
                if(proj_active[p] && proj_from_player[p]) {
                    int proj_w = 8; int proj_h = 8;
                    if (proj_x[p] + proj_w > actor_10_x + 0 && proj_x[p] < actor_10_x + 0 + 16 &&
                        proj_y[p] + proj_h > actor_10_y + 0 && proj_y[p] < actor_10_y + 0 + 16) {
                        proj_active[p] = false;
                        actor_10_hp--;
                        bn::sound_items::snd_square_440_100.play();
                        if (actor_10_hp <= 0) {
                            actor_10_active = false;
                            actor_10_sprite.set_visible(false);
                            actor_4_float_x = actor_10_x;
                            actor_4_float_y = actor_10_y;
                            actor_4_x = actor_10_x;
                            actor_4_y = actor_10_y;
                            actor_4_active = true;
                        }
                    }
                }
            }
        }
        if (actor_11_active) {
            actor_11_dx = 0;
            actor_11_dy = 0;
        }
        if (actor_12_active) {
            actor_12_dx = 0;
            actor_12_dy = 0;
        }
        if (actor_13_active) {
            actor_13_dx = 0;
            actor_13_dy = 0;
        }
        if (actor_14_active) {
            actor_14_dx = 0;
            actor_14_dy = 0;
        }


        bn::core::update();
    }
}
