'use client';

import { motion, useReducedMotion } from 'motion/react';

const stories = [
  {
    label: '校园空间',
    title: '每一所校园，都有自己的学习节奏。',
    description:
      '从图书馆到自习室，从楼层到座位，席定把分散的空间与实时状态整理成一张清楚的选择地图。',
    image: 'campus-study-hall',
    alt: '学生在开放式高校图书馆学习空间中自习',
    width: 1600,
    height: 1600
  },
  {
    label: '个人偏好',
    title: '你记住喜欢的位置，席定记住剩下的。',
    description:
      '座位、日期、使用时段与备选顺序会成为你的预约计划。下一次开放时，平台按你的选择执行。',
    image: 'reserved-study-seat',
    alt: '图书馆内带编号和阅读灯的独立学习座位',
    width: 1600,
    height: 1200
  }
];

export function CampusStories() {
  const reduceMotion = useReducedMotion();

  return (
    <section className='mx-auto flex max-w-7xl flex-col gap-24 px-6 py-24 lg:px-8 lg:py-32'>
      {stories.map((story, index) => (
        <motion.article
          key={story.image}
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className='grid items-center gap-8 lg:grid-cols-2 lg:gap-16'
        >
          <div className={index % 2 ? 'lg:order-2' : undefined}>
            <picture>
              <source
                type='image/avif'
                srcSet={`/landing/${story.image}-640.avif 640w, /landing/${story.image}-1200.avif 1200w, /landing/${story.image}-1600.avif 1600w`}
                sizes='(max-width: 1024px) calc(100vw - 3rem), 50vw'
              />
              <source
                type='image/webp'
                srcSet={`/landing/${story.image}-640.webp 640w, /landing/${story.image}-1200.webp 1200w, /landing/${story.image}-1600.webp 1600w`}
                sizes='(max-width: 1024px) calc(100vw - 3rem), 50vw'
              />
              <img
                src={`/landing/${story.image}-1600.webp`}
                alt={story.alt}
                width={story.width}
                height={story.height}
                loading='lazy'
                decoding='async'
                className='aspect-[4/3] w-full rounded-lg object-cover'
              />
            </picture>
          </div>
          <div className='max-w-xl'>
            <p className='text-sm font-semibold text-amber-700 dark:text-amber-300'>
              {story.label}
            </p>
            <h2 className='mt-3 text-3xl font-bold sm:text-4xl'>{story.title}</h2>
            <p className='text-muted-foreground mt-5 text-base leading-7 sm:text-lg sm:leading-8'>
              {story.description}
            </p>
          </div>
        </motion.article>
      ))}
    </section>
  );
}
