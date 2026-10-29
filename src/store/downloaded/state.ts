interface InitState {
  /** 已下载集合（key=`${source}__${songId}`，仅 status==completed 且文件在位） */
  set: Set<string>
}

const state: InitState = {
  set: new Set(),
}


export {
  state,
}
