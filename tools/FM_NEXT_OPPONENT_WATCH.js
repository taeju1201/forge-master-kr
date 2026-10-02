'use strict';

const PACKAGE = 'com.hariwn.legendofcivilizations';
const POLL_MS = 2000;

let api = null;
let managerClass = NULL;
let getInstance = NULL;
let lastKey = '';
let started = false;

function nowIso() { return new Date().toISOString(); }
function emit(type, payload) {
  send(Object.assign({ type, ts: nowIso() }, payload || {}));
}
function exp(mod, name, ret, args) {
  return new NativeFunction(mod.getExportByName(name), ret, args);
}
function readIl2CppString(obj) {
  if (!obj || obj.isNull()) return '';
  try {
    const len = api.string_length(obj);
    const chars = api.string_chars(obj);
    if (chars.isNull() || len <= 0) return '';
    return chars.readUtf16String(len) || '';
  } catch (_) {
    return '';
  }
}
function invoke(method, obj) {
  if (!method || method.isNull()) return NULL;
  const exc = Memory.alloc(Process.pointerSize);
  exc.writePointer(NULL);
  const result = api.runtime_invoke(method, obj || NULL, NULL, exc);
  const ex = exc.readPointer();
  if (!ex.isNull()) throw new Error('IL2CPP exception @ ' + method);
  return result;
}
function invokeString(method, obj) {
  return readIl2CppString(invoke(method, obj));
}
function invokeInt(method, obj, fallback) {
  try {
    const boxed = invoke(method, obj);
    if (!boxed || boxed.isNull()) return fallback;
    const p = api.object_unbox(boxed);
    return p.isNull() ? fallback : p.readS32();
  } catch (_) { return fallback; }
}
function invokeBool(method, obj, fallback) {
  try {
    const boxed = invoke(method, obj);
    if (!boxed || boxed.isNull()) return fallback;
    const p = api.object_unbox(boxed);
    return p.isNull() ? fallback : !!p.readU8();
  } catch (_) { return fallback; }
}
function method(klass, name) {
  return api.class_get_method_from_name(klass, Memory.allocUtf8String(name), 0);
}
function findAssemblyCSharpImage() {
  const countPtr = Memory.alloc(Process.pointerSize);
  countPtr.writePointer(NULL);
  const arr = api.domain_get_assemblies(api.domain, countPtr);
  const count = Process.pointerSize === 8 ? Number(countPtr.readU64()) : countPtr.readU32();
  for (let i = 0; i < count; i++) {
    const asm = arr.add(i * Process.pointerSize).readPointer();
    const image = api.assembly_get_image(asm);
    const namePtr = api.image_get_name(image);
    const name = namePtr.isNull() ? '' : namePtr.readCString();
    if (name === 'Assembly-CSharp.dll' || name === 'Assembly-CSharp') return image;
  }
  return NULL;
}
function init() {
  if (started) return true;
  const mod = Process.findModuleByName('libil2cpp.so');
  if (!mod) return false;

  api = {
    domain_get: exp(mod, 'il2cpp_domain_get', 'pointer', []),
    domain_get_assemblies: exp(mod, 'il2cpp_domain_get_assemblies', 'pointer', ['pointer','pointer']),
    thread_attach: exp(mod, 'il2cpp_thread_attach', 'pointer', ['pointer']),
    assembly_get_image: exp(mod, 'il2cpp_assembly_get_image', 'pointer', ['pointer']),
    image_get_name: exp(mod, 'il2cpp_image_get_name', 'pointer', ['pointer']),
    class_from_name: exp(mod, 'il2cpp_class_from_name', 'pointer', ['pointer','pointer','pointer']),
    class_get_method_from_name: exp(mod, 'il2cpp_class_get_method_from_name', 'pointer', ['pointer','pointer','int']),
    runtime_invoke: exp(mod, 'il2cpp_runtime_invoke', 'pointer', ['pointer','pointer','pointer','pointer']),
    object_unbox: exp(mod, 'il2cpp_object_unbox', 'pointer', ['pointer']),
    string_chars: exp(mod, 'il2cpp_string_chars', 'pointer', ['pointer']),
    string_length: exp(mod, 'il2cpp_string_length', 'int', ['pointer'])
  };
  api.domain = api.domain_get();
  api.thread_attach(api.domain);

  const image = findAssemblyCSharpImage();
  if (image.isNull()) throw new Error('Assembly-CSharp image not found');

  managerClass = api.class_from_name(
    image,
    Memory.allocUtf8String(''),
    Memory.allocUtf8String('GuildWarManager')
  );
  if (managerClass.isNull()) throw new Error('GuildWarManager class not found');

  getInstance = method(managerClass, 'get_Instance');
  api.m = {
    isActive: method(managerClass, 'get_IsActive'),
    isLoading: method(managerClass, 'get_IsLoading'),
    opponentName: method(managerClass, 'get_OpponentName'),
    opponentTag: method(managerClass, 'get_OpponentTag'),
    opponentTier: method(managerClass, 'get_OpponentTier'),
    opponentServer: method(managerClass, 'get_OpponentServer'),
    currentParticipantIndex: method(managerClass, 'get_CurrentParticipantIndex'),
    currentDay: method(managerClass, 'get_CurrentDay'),
    isLastDay: method(managerClass, 'get_IsLastDay'),
    currentWarEnded: method(managerClass, 'get_CurrentWarEnded'),
    isSittingOut: method(managerClass, 'get_IsSittingOutCurrentWar')
  };

  started = true;
  emit('status', {
    state: 'ready',
    package: PACKAGE,
    class: 'GuildWarManager',
    poll_ms: POLL_MS,
    note: 'NextParticipantIdx is NOT used; it is Metaplay division allocation state, not the next opponent.'
  });
  return true;
}
function sample() {
  if (!init()) return;
  try {
    api.thread_attach(api.domain);
    const inst = invoke(getInstance, NULL);
    if (!inst || inst.isNull()) return;

    const row = {
      active: invokeBool(api.m.isActive, inst, false),
      loading: invokeBool(api.m.isLoading, inst, false),
      opponent_name: invokeString(api.m.opponentName, inst),
      opponent_tag: invokeString(api.m.opponentTag, inst),
      opponent_tier: invokeInt(api.m.opponentTier, inst, -1),
      opponent_server: invokeString(api.m.opponentServer, inst),
      participant_index: invokeInt(api.m.currentParticipantIndex, inst, -1),
      current_day: invokeInt(api.m.currentDay, inst, -1),
      last_day: invokeBool(api.m.isLastDay, inst, false),
      war_ended: invokeBool(api.m.currentWarEnded, inst, false),
      sitting_out: invokeBool(api.m.isSittingOut, inst, false)
    };

    const key = [row.opponent_name,row.opponent_tag,row.opponent_tier,row.opponent_server].join('|');
    if (row.opponent_name && key !== lastKey) {
      lastKey = key;
      emit('opponent_assigned', row);
    } else if (!row.opponent_name && lastKey) {
      lastKey = '';
      emit('opponent_cleared', row);
    }
  } catch (e) {
    emit('error', { where: 'sample', error: String(e.stack || e) });
  }
}

emit('status', { state: 'waiting_for_libil2cpp', package: PACKAGE });
setInterval(sample, POLL_MS);
sample();
