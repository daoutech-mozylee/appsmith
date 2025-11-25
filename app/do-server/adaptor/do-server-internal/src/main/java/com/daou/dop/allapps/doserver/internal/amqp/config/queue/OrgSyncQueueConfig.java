package com.daou.dop.allapps.doserver.internal.amqp.config.queue;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OrgSyncQueueConfig {

    public static final String QUEUE_NAME = "dop_user_company_sync.do_server.org_sync.queue";
    public static final String EXCHANGE_NAME = "dop_user_company_sync.exchange";
    public static final String ROUTING_KEY = "org.sync.#";

    @Bean
    public Queue orgSyncQueue() {
        return new Queue(QUEUE_NAME, true);  // durable = true
    }

    @Bean
    public TopicExchange orgSyncExchange() {
        return new TopicExchange(EXCHANGE_NAME, true, false);
    }

    @Bean
    public Binding orgSyncBinding(Queue orgSyncQueue, TopicExchange orgSyncExchange) {
        return BindingBuilder
            .bind(orgSyncQueue)
            .to(orgSyncExchange)
            .with(ROUTING_KEY);
    }
}
