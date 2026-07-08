// plugins/MyImagePlugin/events/eventMyImageEffect.js
export const id = "IMAGE TOOL";
export const name = "Apply Image Effect";
export const groups = ["IMAGE", "EFFECTS"];

export const fields = [
  {
    key: "x",
    label: "X Position",
    type: "number",
    defaultValue: 0,
  },
  {
    key: "new_tile",
    label: "New Tile ID",
    type: "number",
    defaultValue: 1,
  }
];

export const compile = (input, helpers) => {
  const { appendRaw, getVariableAlias } = helpers;
  // This converts your event into GBVM instructions
  appendRaw(`VM_SET_CONST_INT16 _my_x_var, ${input.x}`);
  appendRaw(`VM_SET_CONST_INT16 _my_tile_var, ${input.new_tile}`);
  appendRaw(`VM_CALL_NATIVE _my_native_effect_func, _my_x_var`);
};