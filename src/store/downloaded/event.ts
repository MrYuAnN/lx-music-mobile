import Event from '@/event/Event'


class DownloadedEvent extends Event {
  downloaded_set_changed() {
    this.emit('downloaded_set_changed')
  }
}


type EventMethods = Omit<EventType, keyof Event>


declare class EventType extends DownloadedEvent {
  on<K extends keyof EventMethods>(event: K, listener: EventMethods[K]): any
  off<K extends keyof EventMethods>(event: K, listener: EventMethods[K]): any
}

type DownloadedEventTypes = Omit<EventType, keyof Omit<Event, 'on' | 'off'>>


export const event: DownloadedEventTypes = new DownloadedEvent()
